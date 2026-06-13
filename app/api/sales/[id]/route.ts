import { NextRequest, NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { withAuditLog } from "@/lib/audit-log";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";
import InventoryTransactionModel from "@/models/InventoryTransaction";
import ProductModel from "@/models/Product";
import SaleModel from "@/models/Sale";
import SaleLineModel from "@/models/SaleLine";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function fail(status: number, message: string): never {
  throw new ApiError(status, message);
}

function serializeSale(sale: any, lines: any[] = []) {
  return {
    _id: sale._id.toString(),
    receiptNumber: sale.receiptNumber,
    customerId: sale.customerId?._id?.toString?.() || sale.customerId?.toString?.(),
    customerName: sale.customerId?.name || "",
    saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString() : undefined,
    source: sale.source,
    totalAmount: sale.totalAmount || 0,
    paidAmount: sale.paidAmount || 0,
    balance: sale.balance || 0,
    totalPacks: sale.totalPacks || 0,
    totalQty: sale.totalQty || 0,
    remarks: sale.remarks || "",
    status: sale.status,
    createdByName: sale.createdBy?.name || sale.createdBy?.username || "",
    lines: lines.map((line) => ({
      _id: line._id.toString(),
      source: line.source,
      categoryName: line.categoryName,
      productName: line.productName,
      qty: line.qty || 0,
      price: line.price || 0,
      lineTotal: line.lineTotal || 0,
      stockUnit: line.stockUnit,
      packSize: line.packSize || 0,
      stockPcsOut: line.stockPcsOut || 0,
      remarks: line.remarks || "",
    })),
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission(["sales.view", "sales.manage"]);
  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid sale ID." },
      { status: 400 }
    );
  }

  await dbConnect();

  const sale = await SaleModel.findOne({ _id: id, isVoided: false })
    .populate("customerId", "name")
    .populate("createdBy", "name username")
    .lean();

  if (!sale) {
    return NextResponse.json(
      { success: false, message: "Sale not found." },
      { status: 404 }
    );
  }

  const lines = await SaleLineModel.find({ saleId: id }).lean();

  return NextResponse.json({
    success: true,
    data: serializeSale(sale, lines),
  });
}

async function handleDELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requirePermission("sales.manage");
  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid sale ID." },
      { status: 400 }
    );
  }

  await dbConnect();

  const mongoSession = await mongoose.startSession();

  try {
    await mongoSession.withTransaction(async () => {
      // Atomically claim the sale so two simultaneous voids cannot both run.
      const sale = await SaleModel.findOneAndUpdate(
        { _id: id, isVoided: false, paidAmount: { $lte: 0 } },
        { $set: { isVoided: true, status: "VOIDED", balance: 0 } },
        { new: true, session: mongoSession }
      );

      if (!sale) {
        const existing = await SaleModel.findById(id)
          .select("isVoided paidAmount")
          .session(mongoSession)
          .lean();

        if (!existing || (existing as any).isVoided) {
          fail(404, "Sale not found.");
        }

        fail(
          400,
          "This sale already has payment. Remove or adjust payment first."
        );
      }

      const lines = await SaleLineModel.find({ saleId: sale._id }).session(
        mongoSession
      );

      const inventoryTransactions = [];
      const bodegaTransactions = [];

      for (const line of lines) {
        const stockToRestore = Number(line.stockPcsOut || line.qty || 0);

        if (stockToRestore <= 0) continue;

        if (line.source === "CHICKEN" && line.bodegaProductId) {
          const product = await BodegaProductModel.findOneAndUpdate(
            { _id: line.bodegaProductId },
            { $inc: { stockQty: stockToRestore } },
            { new: true, session: mongoSession }
          );

          if (!product) continue;

          const newStock = Number(product.stockQty || 0);

          bodegaTransactions.push({
            bodegaProductId: product._id,
            type: "VOID_REVERSAL",
            quantity: stockToRestore,
            previousStock: newStock - stockToRestore,
            newStock,
            remarks: `VOID SALE ${sale.receiptNumber}`,
            referenceType: "SALE_VOID",
            referenceId: sale._id,
            createdBy: session?.user?.id,
          });
        }

        if (line.source === "BODEGA" && line.productId) {
          const product = await ProductModel.findOneAndUpdate(
            { _id: line.productId },
            { $inc: { stockPcs: stockToRestore } },
            { new: true, session: mongoSession }
          );

          if (!product) continue;

          const newStock = Number(product.stockPcs || 0);

          inventoryTransactions.push({
            productId: product._id,
            type: "VOID_REVERSAL",
            unit: "PCS",
            quantity: stockToRestore,
            previousStock: newStock - stockToRestore,
            newStock,
            remarks: `VOID SALE ${sale.receiptNumber}`,
            referenceType: "SALE_VOID",
            referenceId: sale._id,
            createdBy: session?.user?.id,
          });
        }
      }

      if (inventoryTransactions.length > 0) {
        await InventoryTransactionModel.insertMany(inventoryTransactions, {
          session: mongoSession,
        });
      }

      if (bodegaTransactions.length > 0) {
        await BodegaStockTransactionModel.insertMany(bodegaTransactions, {
          session: mongoSession,
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Sale voided successfully and stocks were reversed.",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error(error);

    return NextResponse.json(
      { success: false, message: "Unable to void sale." },
      { status: 500 }
    );
  } finally {
    await mongoSession.endSession();
  }
}

export const DELETE = withAuditLog(handleDELETE, {
  module: "SALES",
  action: "VOID",
  entityType: "SALE",
});

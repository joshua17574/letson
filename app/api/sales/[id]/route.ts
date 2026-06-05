// app/api/sales/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";
import InventoryTransactionModel from "@/models/InventoryTransaction";
import ProductModel from "@/models/Product";
import SaleModel from "@/models/Sale";
import SaleLineModel from "@/models/SaleLine";

function serializeSale(sale: any, lines: any[] = []) {
  return {
    _id: sale._id.toString(),
    receiptNumber: sale.receiptNumber,
    customerId:
      sale.customerId?._id?.toString?.() || sale.customerId?.toString?.(),
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
  const { response } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid sale ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const sale = await SaleModel.findOne({
    _id: id,
    isVoided: false,
  })
    .populate("customerId", "name")
    .populate("createdBy", "name username")
    .lean();

  if (!sale) {
    return NextResponse.json(
      {
        success: false,
        message: "Sale not found.",
      },
      { status: 404 }
    );
  }

  const lines = await SaleLineModel.find({
    saleId: id,
  }).lean();

  return NextResponse.json({
    success: true,
    data: serializeSale(sale, lines),
  });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid sale ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const sale = await SaleModel.findOne({
    _id: id,
    isVoided: false,
  });

  if (!sale) {
    return NextResponse.json(
      {
        success: false,
        message: "Sale not found.",
      },
      { status: 404 }
    );
  }

  if (sale.paidAmount > 0) {
    return NextResponse.json(
      {
        success: false,
        message: "This sale already has payment. Remove or adjust payment first.",
      },
      { status: 400 }
    );
  }

  const lines = await SaleLineModel.find({
    saleId: sale._id,
  });

  const inventoryTransactions = [];
  const bodegaTransactions = [];

  for (const line of lines) {
    if (line.source === "CHICKEN" && line.productId) {
      const product = await ProductModel.findOne({
        _id: line.productId,
        isActive: true,
      });

      if (!product) continue;

      const previousStock = product.stockPcs;
      product.stockPcs += line.stockPcsOut;

      await product.save();

      inventoryTransactions.push({
        productId: product._id,
        type: "VOID_REVERSAL",
        unit: "PCS",
        quantity: line.stockPcsOut,
        previousStock,
        newStock: product.stockPcs,
        remarks: `VOID SALE ${sale.receiptNumber}`,
        referenceType: "SALE_VOID",
        referenceId: sale._id,
        createdBy: session?.user?.id,
      });
    }

    if (line.source === "BODEGA" && line.bodegaProductId) {
      const product = await BodegaProductModel.findOne({
        _id: line.bodegaProductId,
        isActive: true,
      });

      if (!product) continue;

      const previousStock = product.stockQty;
      product.stockQty += line.qty;

      await product.save();

      bodegaTransactions.push({
        bodegaProductId: product._id,
        type: "VOID_REVERSAL",
        quantity: line.qty,
        previousStock,
        newStock: product.stockQty,
        remarks: `VOID SALE ${sale.receiptNumber}`,
        referenceType: "SALE_VOID",
        referenceId: sale._id,
        createdBy: session?.user?.id,
      });
    }
  }

  sale.isVoided = true;
  sale.status = "VOIDED";
  sale.balance = 0;

  await sale.save();

  if (inventoryTransactions.length > 0) {
    await InventoryTransactionModel.insertMany(inventoryTransactions);
  }

  if (bodegaTransactions.length > 0) {
    await BodegaStockTransactionModel.insertMany(bodegaTransactions);
  }

  return NextResponse.json({
    success: true,
    message: "Sale voided successfully and stocks were reversed.",
  });
}

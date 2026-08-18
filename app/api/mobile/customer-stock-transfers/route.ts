import mongoose, { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-auth";
import {
  parseMobileCustomerStockTransferRequest,
  serializeMobileInventoryItem,
  type CatalogPriceRecord,
} from "@/lib/mobile-pos-contract";
import connectDb from "@/lib/mongodb";
import AuditLogModel from "@/models/AuditLog";
import BodegaProductModel from "@/models/BodegaProduct";
import OutletInventoryModel from "@/models/OutletInventory";
import OutletStockTransactionModel from "@/models/OutletStockTransaction";
import ProductModel from "@/models/Product";

export const dynamic = "force-dynamic";

class TransferError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function loadSerializedInventory(outletId: string) {
  const inventory = await OutletInventoryModel.find({
    outletId,
    isActive: true,
  })
    .sort({ productName: 1 })
    .lean();
  const bodegaProductIds = inventory
    .filter((item) => item.productSource === "BODEGA")
    .map((item) => item.productId);
  const groceryProductIds = inventory
    .filter((item) => item.productSource === "GROCERY")
    .map((item) => item.productId);
  const [bodegaProducts, groceryProducts] = await Promise.all([
    BodegaProductModel.find({ _id: { $in: bodegaProductIds }, isActive: true })
      .select("_id buyingPrice sellingPrice")
      .lean(),
    ProductModel.find({ _id: { $in: groceryProductIds }, isActive: true })
      .select("_id buyingPrice unitPrice")
      .lean(),
  ]);
  const catalogByKey = new Map<string, NonNullable<CatalogPriceRecord>>();
  for (const product of bodegaProducts) {
    catalogByKey.set(`BODEGA:${product._id.toString()}`, product);
  }
  for (const product of groceryProducts) {
    catalogByKey.set(`GROCERY:${product._id.toString()}`, product);
  }
  return inventory.map((item) =>
    serializeMobileInventoryItem(
      item,
      catalogByKey.get(
        `${item.productSource}:${item.productId?.toString?.() || ""}`,
      ) ?? null,
    ),
  );
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireMobileAuth(req, [
    "outlet-inventory.manage",
    "sales.manage",
  ]);
  if (response) return response;
  if (!user.outlet) {
    return NextResponse.json(
      { success: false, message: "Your account is not assigned to an outlet." },
      { status: 400 },
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400 },
    );
  }
  const parsed = parseMobileCustomerStockTransferRequest(requestBody);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, message: parsed.message },
      { status: 400 },
    );
  }
  if (parsed.value.items.some((item) => !isValidObjectId(item.inventoryId))) {
    return NextResponse.json(
      { success: false, message: "Invalid outlet inventory ID." },
      { status: 400 },
    );
  }

  await connectDb();
  const mongoSession = await mongoose.startSession();
  const transferId = new mongoose.Types.ObjectId();
  const transferredAt = new Date();
  const transferredItems: Array<{
    inventoryId: string;
    productName: string;
    qty: number;
    previousStock: number;
    newStock: number;
  }> = [];

  try {
    await mongoSession.withTransaction(async () => {
      transferredItems.length = 0;
      for (const item of parsed.value.items) {
        const inventory = await OutletInventoryModel.findOneAndUpdate(
          {
            _id: item.inventoryId,
            outletId: user.outlet!.id,
            isActive: true,
            categoryName: /^CHICKEN$/i,
            stockQty: { $gte: item.qty },
          },
          {
            $inc: { stockQty: -item.qty },
            $set: { updatedBy: user.id },
          },
          { new: true, session: mongoSession },
        );
        if (!inventory) {
          const existing = await OutletInventoryModel.findOne({
            _id: item.inventoryId,
            outletId: user.outlet!.id,
            isActive: true,
          }).session(mongoSession);
          if (!existing) {
            throw new TransferError(
              404,
              "Outlet stock item not found. Refresh and try again.",
            );
          }
          if (String(existing.categoryName || "").toUpperCase() !== "CHICKEN") {
            throw new TransferError(
              400,
              `${existing.productName} is not a Chicken product.`,
            );
          }
          throw new TransferError(
            409,
            `Not enough stock for ${existing.productName}. Refresh and try again.`,
          );
        }

        const newStock = Number(inventory.stockQty || 0);
        const previousStock = newStock + item.qty;
        transferredItems.push({
          inventoryId: inventory._id.toString(),
          productName: inventory.productName,
          qty: item.qty,
          previousStock,
          newStock,
        });
        await OutletStockTransactionModel.create(
          [
            {
              outletId: inventory.outletId,
              outletInventoryId: inventory._id,
              productSource: inventory.productSource,
              productId: inventory.productId,
              productName: inventory.productName,
              transactionDate: transferredAt,
              type: "STOCK_OUT",
              quantity: item.qty,
              previousStock,
              newStock,
              referenceType: "CUSTOMER_STOCK_TRANSFER",
              referenceId: transferId,
              sourceChannel: "FLUTTER",
              remarks: `CUSTOMER ${parsed.value.customerName}`,
              createdBy: user.id,
            },
          ],
          { session: mongoSession },
        );
      }

      await AuditLogModel.create(
        [
          {
            outletId: user.outlet!.id,
            module: "OUTLET INVENTORY",
            action: "TRANSFER TO CUSTOMER",
            entityType: "CUSTOMER STOCK TRANSFER",
            entityId: transferId,
            newValue: {
              customerName: parsed.value.customerName,
              items: transferredItems,
            },
            remarks: `CUSTOMER ${parsed.value.customerName}`,
            sourceChannel: "FLUTTER",
            createdBy: user.id,
          },
        ],
        { session: mongoSession },
      );
    });

    return NextResponse.json(
      {
        success: true,
        message: "Stock transferred to customer.",
        transfer: {
          id: transferId.toString(),
          customerName: parsed.value.customerName,
          transferredAt: transferredAt.toISOString(),
          items: transferredItems,
        },
        inventory: await loadSerializedInventory(user.outlet.id),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof TransferError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Unable to transfer outlet stock." },
      { status: 500 },
    );
  } finally {
    await mongoSession.endSession();
  }
}

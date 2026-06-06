import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString } from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function objectIdString(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return String((value as { toString: () => string }).toString());
  }
  return String(value);
}

function getDirection(transaction: any): "IN" | "OUT" | "NONE" {
  const previousStock = numberValue(transaction.previousStock);
  const newStock = numberValue(transaction.newStock);

  if (newStock > previousStock) return "IN";
  if (newStock < previousStock) return "OUT";

  const type = String(transaction.type || "").toUpperCase();
  if (type === "STOCK_IN" || type === "VOID_REVERSAL") return "IN";
  if (["STOCK_OUT", "SALE", "DAMAGED", "EXPIRED"].includes(type)) return "OUT";

  return "NONE";
}

function getMovementQuantity(transaction: any) {
  const explicitQuantity = numberValue(transaction.quantity);
  if (explicitQuantity > 0) return explicitQuantity;

  return Math.abs(numberValue(transaction.newStock) - numberValue(transaction.previousStock));
}

function getReference(transaction: any) {
  const direction = getDirection(transaction);
  const suffix = objectIdString(transaction._id).slice(-6).toUpperCase();
  return `${direction}-${suffix}`;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireApiAuth();
  if (response) return response;

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid product ID." },
      { status: 400 }
    );
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

  const product = await (BodegaProductModel as any)
    .findOne({ _id: id, isActive: true })
    .lean();

  if (!product) {
    return NextResponse.json(
      { success: false, message: "Product not found." },
      { status: 404 }
    );
  }

  const filter: Record<string, any> = { bodegaProductId: id };
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) filter.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
  }

  const transactions = await (BodegaStockTransactionModel as any)
    .find(filter)
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    success: true,
    product: {
      _id: objectIdString(product._id),
      name: product.name,
      currentPcs: numberValue(product.stockQty),
      currentBags: 0,
      currentKilos: 0,
      currentHeads: numberValue(product.stockQty),
      lastUpdated: product.updatedAt ? new Date(product.updatedAt).toISOString() : undefined,
    },
    data: (transactions as any[]).map((transaction) => {
      const direction = getDirection(transaction);
      const quantity = getMovementQuantity(transaction);
      return {
        _id: objectIdString(transaction._id),
        date: transaction.createdAt ? new Date(transaction.createdAt).toISOString() : undefined,
        type: direction === "NONE" ? "IN" : direction,
        reference: getReference(transaction),
        qtyPcs: direction === "IN" ? quantity : 0,
        qtyBags: 0,
        qtyKilos: 0,
        qtyOut: direction === "OUT" ? quantity : 0,
        qtyHeads: quantity,
        previousStock: numberValue(transaction.previousStock),
        newStock: numberValue(transaction.newStock),
        unit: "HEADS",
        remarks: transaction.remarks || transaction.referenceType || "",
      };
    }),
  });
}

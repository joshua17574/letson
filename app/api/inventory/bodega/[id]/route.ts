import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { cleanString } from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";
import StandardPackingModel from "@/models/StandardPacking";

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function wholeNumber(value: unknown) {
  return Math.max(0, Math.trunc(numberValue(value)));
}

function objectIdString(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return String((value as { toString: () => string }).toString());
  }
  return String(value);
}

function getPackBreakdown(quantityValue: unknown, packSizeValue: unknown) {
  const pcs = wholeNumber(quantityValue);
  const packSize = wholeNumber(packSizeValue);

  if (packSize <= 0) {
    return { pcs, packs: 0, loosePcs: pcs };
  }

  const packs = Math.floor(pcs / packSize);
  const loosePcs = pcs - packs * packSize;
  return { pcs, packs, loosePcs };
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

async function getPackSize(productId: string) {
  const standard = await (StandardPackingModel as any)
    .findOne({
      isActive: true,
      productId,
      standardPacking: { $gt: 0 },
    })
    .sort({ updatedAt: -1 })
    .select("standardPacking")
    .lean();

  return wholeNumber(standard?.standardPacking);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission("inventory.view");
  if (response) return response;

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid bodega product ID." },
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
      { success: false, message: "Bodega product not found." },
      { status: 404 }
    );
  }

  const packSize = await getPackSize(id);
  const isPackProduct = packSize > 0;
  const currentBreakdown = getPackBreakdown(product.stockQty, packSize);
  const price = numberValue(product.sellingPrice || product.buyingPrice || 0);
  const pricePerPack = isPackProduct ? price : 0;
  const pricePerPcs = isPackProduct ? price / packSize : price;

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
      currentStock: numberValue(product.stockQty),
      currentStockPcs: currentBreakdown.pcs,
      price: isPackProduct ? pricePerPack : price,
      lastUpdated: product.updatedAt ? new Date(product.updatedAt).toISOString() : undefined,
      isPackProduct,
      packSize,
      currentPacks: currentBreakdown.packs,
      currentLoosePcs: currentBreakdown.loosePcs,
      currentStockPacks: currentBreakdown.packs,
      currentStockLoosePcs: currentBreakdown.loosePcs,
      pricePerPack,
      pricePerPcs,
    },
    data: (transactions as any[]).map((transaction) => {
      const direction = getDirection(transaction);
      const quantity = getMovementQuantity(transaction);
      const previousBreakdown = getPackBreakdown(transaction.previousStock, packSize);
      const newBreakdown = getPackBreakdown(transaction.newStock, packSize);
      const quantityBreakdown = getPackBreakdown(quantity, packSize);

      return {
        _id: objectIdString(transaction._id),
        date: transaction.createdAt ? new Date(transaction.createdAt).toISOString() : undefined,
        type: direction === "NONE" ? "IN" : direction,
        reference: getReference(transaction),
        qtyIn: direction === "IN" ? quantity : 0,
        qtyOut: direction === "OUT" ? quantity : 0,
        previousStock: numberValue(transaction.previousStock || 0),
        newStock: numberValue(transaction.newStock || 0),

        quantityPcs: quantityBreakdown.pcs,
        quantityPacks: quantityBreakdown.packs,
        quantityLoosePcs: quantityBreakdown.loosePcs,
        previousStockPcs: previousBreakdown.pcs,
        previousStockPacks: previousBreakdown.packs,
        previousStockLoosePcs: previousBreakdown.loosePcs,
        newStockPcs: newBreakdown.pcs,
        newStockPacks: newBreakdown.packs,
        newStockLoosePcs: newBreakdown.loosePcs,

        remarks: transaction.remarks || transaction.referenceType || "",
      };
    }),
  });
}

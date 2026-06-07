// app/api/inventory/bodega/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString } from "@/lib/crud-utils";
import { setDateRangeFilter } from "@/lib/date-range";
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

function getPackBreakdown(quantityValue: unknown, packSizeValue: unknown) {
  const quantity = wholeNumber(quantityValue);
  const packSize = wholeNumber(packSizeValue);

  if (packSize <= 0) {
    return {
      pcs: quantity,
      packs: 0,
      loosePcs: quantity,
    };
  }

  const packs = Math.floor(quantity / packSize);
  const loosePcs = quantity - packs * packSize;

  return {
    pcs: quantity,
    packs,
    loosePcs,
  };
}

function getDirection(transaction: any) {
  return Number(transaction.newStock || 0) >= Number(transaction.previousStock || 0)
    ? "IN"
    : "OUT";
}

function getReference(transaction: any) {
  const direction = getDirection(transaction);
  const suffix = transaction._id.toString().slice(-6).toUpperCase();
  return `${direction}-${suffix}`;
}

async function getPackSize(productId: string) {
  const standard = await StandardPackingModel.findOne({
    isActive: true,
    productId,
  })
    .select("standardPacking")
    .lean();

  return wholeNumber(standard?.standardPacking);
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
      {
        success: false,
        message: "Invalid bodega product ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

  const product = await BodegaProductModel.findOne({
    _id: id,
    isActive: true,
  }).lean();

  if (!product) {
    return NextResponse.json(
      {
        success: false,
        message: "Bodega product not found.",
      },
      { status: 404 }
    );
  }

  const packSize = await getPackSize(id);
  const isPackProduct = packSize > 0;
  const currentBreakdown = getPackBreakdown(product.stockQty, packSize);
  const pricePerPack = numberValue(product.sellingPrice);
  const pricePerPcs = isPackProduct ? pricePerPack / packSize : 0;

  const filter: any = {
    bodegaProductId: id,
  };

  setDateRangeFilter(filter, "createdAt", dateFrom, dateTo);

  const transactions = await BodegaStockTransactionModel.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    success: true,
    product: {
      _id: product._id.toString(),
      name: product.name,
      currentStock: numberValue(product.stockQty),
      price: isPackProduct ? pricePerPack : numberValue(product.sellingPrice),
      lastUpdated: product.updatedAt ? new Date(product.updatedAt).toISOString() : undefined,
      isPackProduct,
      packSize,
      currentStockPcs: currentBreakdown.pcs,
      currentStockPacks: currentBreakdown.packs,
      currentStockLoosePcs: currentBreakdown.loosePcs,
      pricePerPack: isPackProduct ? pricePerPack : 0,
      pricePerPcs,
    },
    data: transactions.map((transaction) => {
      const direction = getDirection(transaction);
      const quantity = numberValue(transaction.quantity || 0);
      const previousBreakdown = getPackBreakdown(transaction.previousStock, packSize);
      const newBreakdown = getPackBreakdown(transaction.newStock, packSize);
      const quantityBreakdown = getPackBreakdown(quantity, packSize);

      return {
        _id: transaction._id.toString(),
        date: transaction.createdAt ? new Date(transaction.createdAt).toISOString() : undefined,
        type: direction,
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

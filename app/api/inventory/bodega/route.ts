import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString, escapeRegex } from "@/lib/crud-utils";
import { setDateRangeFilter } from "@/lib/date-range";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";
import StandardPackingModel from "@/models/StandardPacking";

function getTransactionSign(type: string) {
  if (type === "STOCK_IN") return "IN";
  if (type === "STOCK_OUT") return "OUT";
  if (type === "SALE") return "OUT";
  if (type === "DAMAGED") return "OUT";
  if (type === "EXPIRED") return "OUT";
  if (type === "VOID_REVERSAL") return "OUT";
  return "NONE";
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toWhole(value: unknown) {
  return Math.max(0, Math.trunc(toNumber(value)));
}

function getPackBreakdown(totalPcsValue: unknown, packSizeValue: unknown) {
  const totalPcs = toWhole(totalPcsValue);
  const packSize = toWhole(packSizeValue);

  if (packSize <= 0) {
    return {
      totalPcs,
      packSize: 0,
      packs: 0,
      loosePcs: totalPcs,
    };
  }

  const packs = Math.floor(totalPcs / packSize);
  const loosePcs = totalPcs - packs * packSize;

  return {
    totalPcs,
    packSize,
    packs,
    loosePcs,
  };
}

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const search = cleanString(searchParams.get("search"));
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

  const productFilter: Record<string, any> = {
    isActive: true,
  };

  if (search) {
    productFilter.name = { $regex: escapeRegex(search), $options: "i" };
  }

  const products = await BodegaProductModel.find(productFilter)
    .sort({ name: 1 })
    .lean();

  const productIds = products
    .map((product: any) => product._id)
    .filter(Boolean);

  const transactionFilter: Record<string, any> = {
    bodegaProductId: { $in: productIds },
  };

  setDateRangeFilter(transactionFilter, "createdAt", dateFrom, dateTo);

  const [transactions, standardPackings] = await Promise.all([
    BodegaStockTransactionModel.find(transactionFilter)
      .sort({ createdAt: -1 })
      .lean(),
    (StandardPackingModel as any)
      .find({
        isActive: true,
        productId: { $in: productIds },
        standardPacking: { $gt: 0 },
      })
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const packSizeMap = new Map<string, number>();

  for (const standard of standardPackings as any[]) {
    const productId = standard.productId?.toString?.() || "";
    const packSize = toWhole(standard.standardPacking);

    if (!productId || packSize <= 0) continue;

    // If the same sliced product appears in multiple standards, keep the most
    // recently updated active standard. Standard packing should normally be the
    // same per output product.
    if (!packSizeMap.has(productId)) {
      packSizeMap.set(productId, packSize);
    }
  }

  const movementMap = new Map<
    string,
    {
      stockIn: number;
      stockOut: number;
      latestDate?: Date;
    }
  >();

  for (const transaction of transactions as any[]) {
    const productId = transaction.bodegaProductId?.toString?.() || "";
    const sign = getTransactionSign(transaction.type);
    const quantity = toNumber(transaction.quantity);
    const current = movementMap.get(productId) || {
      stockIn: 0,
      stockOut: 0,
      latestDate: undefined,
    };

    if (sign === "IN") {
      current.stockIn += quantity;
    }

    if (sign === "OUT") {
      current.stockOut += quantity;
    }

    if (
      transaction.createdAt &&
      (!current.latestDate ||
        new Date(transaction.createdAt) > new Date(current.latestDate))
    ) {
      current.latestDate = transaction.createdAt;
    }

    movementMap.set(productId, current);
  }

  const data = products.map((product: any) => {
    const id = product._id.toString();
    const movement = movementMap.get(id) || {
      stockIn: 0,
      stockOut: 0,
      latestDate: product.createdAt,
    };

    const packSize = packSizeMap.get(id) || 0;
    const isPackProduct = packSize > 0;
    const stockInBreakdown = getPackBreakdown(movement.stockIn, packSize);
    const stockOutBreakdown = getPackBreakdown(movement.stockOut, packSize);
    const currentBreakdown = getPackBreakdown(product.stockQty, packSize);
    const price = toNumber(product.sellingPrice || product.buyingPrice || 0);
    const pricePerPcs = isPackProduct && packSize > 0 ? price / packSize : price;

    return {
      _id: id,
      product: product.name,
      stockIn: toNumber(movement.stockIn),
      stockOut: toNumber(movement.stockOut),
      currentStock: toNumber(product.stockQty),
      price,
      pricePerPack: isPackProduct ? price : 0,
      pricePerPcs,
      stockUnit: isPackProduct ? "PACK_PCS" : "UNIT",
      isPackProduct,
      packSize,
      stockInPacks: stockInBreakdown.packs,
      stockInLoosePcs: stockInBreakdown.loosePcs,
      stockOutPacks: stockOutBreakdown.packs,
      stockOutLoosePcs: stockOutBreakdown.loosePcs,
      currentPacks: currentBreakdown.packs,
      currentLoosePcs: currentBreakdown.loosePcs,
      dateAdded: movement.latestDate
        ? new Date(movement.latestDate).toISOString()
        : product.createdAt
          ? new Date(product.createdAt).toISOString()
          : undefined,
    };
  });

  const totals = data.reduce(
    (sum, row) => ({
      stockIn: sum.stockIn + row.stockIn,
      stockOut: sum.stockOut + row.stockOut,
      currentStock: sum.currentStock + row.currentStock,
      slicedStockInPcs:
        sum.slicedStockInPcs + (row.isPackProduct ? row.stockIn : 0),
      slicedStockOutPcs:
        sum.slicedStockOutPcs + (row.isPackProduct ? row.stockOut : 0),
      slicedCurrentPcs:
        sum.slicedCurrentPcs + (row.isPackProduct ? row.currentStock : 0),
      unitStockIn: sum.unitStockIn + (!row.isPackProduct ? row.stockIn : 0),
      unitStockOut: sum.unitStockOut + (!row.isPackProduct ? row.stockOut : 0),
      unitCurrentStock:
        sum.unitCurrentStock + (!row.isPackProduct ? row.currentStock : 0),
    }),
    {
      stockIn: 0,
      stockOut: 0,
      currentStock: 0,
      slicedStockInPcs: 0,
      slicedStockOutPcs: 0,
      slicedCurrentPcs: 0,
      unitStockIn: 0,
      unitStockOut: 0,
      unitCurrentStock: 0,
    }
  );

  return NextResponse.json({
    success: true,
    data,
    totals,
  });
}

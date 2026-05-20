// app/api/inventory/bodega/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString, escapeRegex } from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";

function getTransactionSign(type: string) {
  if (type === "STOCK_IN") return "IN";
  if (type === "STOCK_OUT") return "OUT";
  if (type === "VOID_REVERSAL") return "OUT";
  return "NONE";
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
    productFilter.name = {
      $regex: escapeRegex(search),
      $options: "i",
    };
  }

  const products = await BodegaProductModel.find(productFilter)
    .sort({ name: 1 })
    .lean();

  const productIds = products.map((product) => product._id);

  const transactionFilter: Record<string, any> = {
    bodegaProductId: {
      $in: productIds,
    },
  };

  if (dateFrom || dateTo) {
    transactionFilter.createdAt = {};

    if (dateFrom) {
      transactionFilter.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      transactionFilter.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  const transactions = await BodegaStockTransactionModel.find(transactionFilter)
    .sort({ createdAt: -1 })
    .lean();

  const movementMap = new Map<
    string,
    {
      stockIn: number;
      stockOut: number;
      latestDate?: Date;
    }
  >();

  for (const transaction of transactions) {
    const productId = transaction.bodegaProductId?.toString?.() || "";
    const sign = getTransactionSign(transaction.type);
    const quantity = Number(transaction.quantity || 0);

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

  const data = products.map((product) => {
    const id = product._id.toString();
    const movement = movementMap.get(id) || {
      stockIn: 0,
      stockOut: 0,
      latestDate: product.createdAt,
    };

    return {
      _id: id,
      product: product.name,
      stockIn: movement.stockIn,
      stockOut: movement.stockOut,
      currentStock: Number(product.stockQty || 0),
      price: Number(product.sellingPrice || product.buyingPrice || 0),
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
    }),
    {
      stockIn: 0,
      stockOut: 0,
      currentStock: 0,
    }
  );

  return NextResponse.json({
    success: true,
    data,
    totals,
  });
}
// app/api/inventory/bodega/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { QueryFilter} from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString, escapeRegex } from "@/lib/crud-utils";
import BodegaProductModel, { IBodegaProduct } from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";

function isInMovement(transaction: any) {
  return Number(transaction.newStock || 0) > Number(transaction.previousStock || 0);
}

function isOutMovement(transaction: any) {
  return Number(transaction.newStock || 0) < Number(transaction.previousStock || 0);
}

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);

  const search = cleanString(searchParams.get("search"));
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

  const productFilter: QueryFilter<IBodegaProduct> = {
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

  const data = [];

  let totalStockIn = 0;
  let totalStockOut = 0;
  let totalCurrentStock = 0;

  for (const product of products) {
    const transactionFilter: any = {
      bodegaProductId: product._id,
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

    let stockIn = 0;
    let stockOut = 0;

    for (const transaction of transactions) {
      const qty = Number(transaction.quantity || 0);

      if (isInMovement(transaction)) stockIn += qty;
      if (isOutMovement(transaction)) stockOut += qty;
    }

    totalStockIn += stockIn;
    totalStockOut += stockOut;
    totalCurrentStock += Number(product.stockQty || 0);

    data.push({
      _id: product._id.toString(),
      product: product.name,
      stockIn,
      stockOut,
      currentStock: Number(product.stockQty || 0),
      price: Number(product.sellingPrice || 0),
      dateAdded: product.createdAt
        ? new Date(product.createdAt).toISOString()
        : undefined,
    });
  }

  return NextResponse.json({
    success: true,
    data,
    totals: {
      stockIn: totalStockIn,
      stockOut: totalStockOut,
      currentStock: totalCurrentStock,
    },
  });
}
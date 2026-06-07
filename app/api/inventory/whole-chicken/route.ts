// app/api/inventory/whole-chicken/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { QueryFilter } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString, escapeRegex } from "@/lib/crud-utils";
import { setDateRangeFilter } from "@/lib/date-range";
import ProductModel, { IProduct } from "@/models/Product";
import InventoryTransactionModel from "@/models/InventoryTransaction";

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

  const productFilter: QueryFilter<IProduct> = {
    isActive: true,
  };

  if (search) {
    productFilter.name = {
      $regex: escapeRegex(search),
      $options: "i",
    };
  }

  const products = await ProductModel.find(productFilter).sort({ name: 1 }).lean();

  const data = [];

  let totalInPcs = 0;
  let totalInBags = 0;
  let totalInKilos = 0;
  let totalOutQty = 0;
  let totalCurrentPcs = 0;

  for (const product of products) {
    const transactionFilter: any = {
      productId: product._id,
    };

    setDateRangeFilter(transactionFilter, "createdAt", dateFrom, dateTo);

    const transactions = await InventoryTransactionModel.find(transactionFilter)
      .sort({ createdAt: -1 })
      .lean();

    let inPcs = 0;
    let inBags = 0;
    let inKilos = 0;
    let outQty = 0;

    for (const transaction of transactions) {
      const qty = Number(transaction.quantity || 0);

      if (isInMovement(transaction)) {
        if (transaction.unit === "PCS") inPcs += qty;
        if (transaction.unit === "BAGS") inBags += qty;
        if (transaction.unit === "KILOS") inKilos += qty;
      }

      if (isOutMovement(transaction)) {
        if (transaction.unit === "PCS") outQty += qty;
      }
    }

    totalInPcs += inPcs;
    totalInBags += inBags;
    totalInKilos += inKilos;
    totalOutQty += outQty;
    totalCurrentPcs += Number(product.stockPcs || 0);

    data.push({
      _id: product._id.toString(),
      product: product.name,
      inPcs,
      inBags,
      inKilos,
      outQty,
      currentPcs: Number(product.stockPcs || 0),
      currentBags: Number(product.stockBags || 0),
      currentKilos: Number(product.stockKilos || 0),
      updated: product.updatedAt
        ? new Date(product.updatedAt).toISOString()
        : undefined,
    });
  }

  return NextResponse.json({
    success: true,
    data,
    totals: {
      inPcs: totalInPcs,
      inBags: totalInBags,
      inKilos: totalInKilos,
      outQty: totalOutQty,
      currentPcs: totalCurrentPcs,
    },
  });
}

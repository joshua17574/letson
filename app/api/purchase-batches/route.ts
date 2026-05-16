// app/api/purchase-batches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { QueryFilter, isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import {
  cleanNumber,
  cleanString,
  getPagination,
} from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";
import PurchaseBatchModel, { IPurchaseBatch } from "@/models/PurchaseBatch";
import PurchaseItemModel from "@/models/PurchaseItem";

type PurchaseItemInput = {
  bodegaProductId: string;
  buyingPrice: number;
  quantity: number;
};

function serializePurchaseBatch(batch: any) {
  return {
    _id: batch._id.toString(),
    datePurchased: batch.datePurchased
      ? new Date(batch.datePurchased).toISOString()
      : undefined,
    totalItems: batch.totalItems || 0,
    totalAmount: batch.totalAmount || 0,
    remarks: batch.remarks || "",
    createdAt: batch.createdAt
      ? new Date(batch.createdAt).toISOString()
      : undefined,
    updatedAt: batch.updatedAt
      ? new Date(batch.updatedAt).toISOString()
      : undefined,
  };
}

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));
  const minTotal = cleanNumber(searchParams.get("minTotal"));
  const maxTotal = cleanNumber(searchParams.get("maxTotal"));

  const filter: QueryFilter<IPurchaseBatch> = {
    isVoided: false,
  };

  if (dateFrom || dateTo) {
    filter.datePurchased = {};

    if (dateFrom) {
      filter.datePurchased.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      filter.datePurchased.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  if (minTotal > 0 || maxTotal > 0) {
    filter.totalAmount = {};

    if (minTotal > 0) {
      filter.totalAmount.$gte = minTotal;
    }

    if (maxTotal > 0) {
      filter.totalAmount.$lte = maxTotal;
    }
  }

  const [items, total, summary] = await Promise.all([
    PurchaseBatchModel.find(filter)
      .sort({ datePurchased: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    PurchaseBatchModel.countDocuments(filter),

    PurchaseBatchModel.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: null,
          filteredBatches: {
            $sum: 1,
          },
          totalItems: {
            $sum: "$totalItems",
          },
          grandTotalAmount: {
            $sum: "$totalAmount",
          },
        },
      },
    ]),
  ]);

  const summaryData = summary[0] || {
    filteredBatches: 0,
    totalItems: 0,
    grandTotalAmount: 0,
  };

  return NextResponse.json({
    success: true,
    data: items.map(serializePurchaseBatch),
    summary: {
      filteredBatches: summaryData.filteredBatches,
      totalItems: summaryData.totalItems,
      grandTotalAmount: summaryData.grandTotalAmount,
    },
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}

export async function POST(req: NextRequest) {
  const { response, session } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const body = await req.json();

  const datePurchased = cleanString(body.datePurchased);
  const remarks = cleanString(body.remarks);

  const items: PurchaseItemInput[] = Array.isArray(body.items)
    ? body.items
    : [];

  if (!datePurchased) {
    return NextResponse.json(
      {
        success: false,
        message: "Date purchased is required.",
      },
      { status: 400 }
    );
  }

  if (items.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: "At least one purchase item is required.",
      },
      { status: 400 }
    );
  }

  let totalItems = 0;
  let totalAmount = 0;

  const preparedItems = [];

  for (const item of items) {
    const bodegaProductId = cleanString(item.bodegaProductId);

    if (!bodegaProductId || !isValidObjectId(bodegaProductId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product in purchase item.",
        },
        { status: 400 }
      );
    }

    const product = await BodegaProductModel.findOne({
      _id: bodegaProductId,
      isActive: true,
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          message: "One selected bodega product was not found.",
        },
        { status: 404 }
      );
    }

    const buyingPrice = cleanNumber(item.buyingPrice);
    const quantity = cleanNumber(item.quantity);

    if (quantity <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Quantity must be greater than zero for ${product.name}.`,
        },
        { status: 400 }
      );
    }

    const subtotal = buyingPrice * quantity;

    totalItems += quantity;
    totalAmount += subtotal;

    preparedItems.push({
      product,
      bodegaProductId: product._id,
      productName: product.name,
      buyingPrice,
      quantity,
      subtotal,
    });
  }

  const batch = await PurchaseBatchModel.create({
    datePurchased: new Date(datePurchased),
    totalItems,
    totalAmount,
    remarks,
    createdBy: session?.user?.id,
  });

  const purchaseItemsToInsert = [];
  const stockTransactions = [];

  for (const item of preparedItems) {
    const product = item.product;

    purchaseItemsToInsert.push({
      purchaseBatchId: batch._id,
      bodegaProductId: item.bodegaProductId,
      productName: item.productName,
      buyingPrice: item.buyingPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
    });

    const previousStock = product.stockQty;
    product.stockQty += item.quantity;
    product.buyingPrice = item.buyingPrice;

    await product.save();

    stockTransactions.push({
      bodegaProductId: product._id,
      type: "STOCK_IN",
      quantity: item.quantity,
      previousStock,
      newStock: product.stockQty,
      remarks: `PURCHASE BATCH ${batch._id.toString()}`,
      referenceType: "PURCHASE_BATCH",
      referenceId: batch._id,
      createdBy: session?.user?.id,
    });
  }

  await PurchaseItemModel.insertMany(purchaseItemsToInsert);

  if (stockTransactions.length > 0) {
    await BodegaStockTransactionModel.insertMany(stockTransactions);
  }

  return NextResponse.json(
    {
      success: true,
      message: "Purchase batch created successfully.",
      data: serializePurchaseBatch(batch.toObject()),
    },
    { status: 201 }
  );
}
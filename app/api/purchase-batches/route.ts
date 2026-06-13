// app/api/purchase-batches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { withAuditLog } from "@/lib/audit-log";
import {
  cleanNumber,
  cleanString,
  getPagination,
} from "@/lib/crud-utils";
import ProductModel from "@/models/Product";
import PurchaseBatchModel from "@/models/PurchaseBatch";
import PurchaseItemModel from "@/models/PurchaseItem";

type PurchaseItemInput = {
  productId: string;
  buyingPrice: number;
  quantity: number;
};

function serializePurchaseBatch(batch: any) {
  return {
    _id: batch._id.toString(),

    datePurchased: batch.datePurchased
      ? new Date(batch.datePurchased).toISOString()
      : undefined,

    totalItems: Number(batch.totalItems || 0),
    totalAmount: Number(batch.totalAmount || 0),
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
  const { response } = await requirePermission(["purchase-items.view", "purchase-items.manage"]);

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));
  const minTotal = cleanNumber(searchParams.get("minTotal"));
  const maxTotal = cleanNumber(searchParams.get("maxTotal"));

  const filter: Record<string, any> = {
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
      filteredBatches: Number(summaryData.filteredBatches || 0),
      totalItems: Number(summaryData.totalItems || 0),
      grandTotalAmount: Number(summaryData.grandTotalAmount || 0),
    },
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}

async function handlePOST(req: NextRequest) {
  const { response, session } = await requirePermission("purchase-items.manage");

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
    const productId = cleanString(item.productId);

    if (!productId || !isValidObjectId(productId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product in purchase item.",
        },
        { status: 400 }
      );
    }

    const product = await ProductModel.findOne({
      _id: productId,
      isActive: true,
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          message: "One selected product was not found.",
        },
        { status: 404 }
      );
    }

    const buyingPrice = cleanNumber(item.buyingPrice);
    const quantity = cleanNumber(item.quantity);

    if (buyingPrice <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Buying price must be greater than zero for ${product.name}.`,
        },
        { status: 400 }
      );
    }

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
      productId: product._id,
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

  for (const item of preparedItems) {
    const product = item.product;

    purchaseItemsToInsert.push({
      purchaseBatchId: batch._id,

      productId: item.productId,
      productName: item.productName,

      buyingPrice: item.buyingPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
    });

    const previousStock = Number(product.stockPcs || 0);

    product.stockPcs = previousStock + item.quantity;
    product.buyingPrice = item.buyingPrice;

    await product.save();
  }

  await PurchaseItemModel.insertMany(purchaseItemsToInsert);

  return NextResponse.json(
    {
      success: true,
      message: "Purchase batch created successfully.",
      data: serializePurchaseBatch(batch.toObject()),
    },
    { status: 201 }
  );
}

export const POST = withAuditLog(handlePOST, {
  module: "PURCHASE_ITEMS",
  action: "CREATE",
  entityType: "PURCHASE_BATCH",
});

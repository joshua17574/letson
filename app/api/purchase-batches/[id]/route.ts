// app/api/purchase-batches/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanNumber, cleanString } from "@/lib/crud-utils";
import ProductModel from "@/models/Product";
import PurchaseBatchModel from "@/models/PurchaseBatch";
import PurchaseItemModel from "@/models/PurchaseItem";

type PurchaseItemInput = {
  productId: string;
  buyingPrice: number;
  quantity: number;
};

function serializePurchaseBatch(batch: any, items: any[] = []) {
  return {
    _id: batch._id.toString(),

    datePurchased: batch.datePurchased
      ? new Date(batch.datePurchased).toISOString()
      : undefined,

    totalItems: Number(batch.totalItems || 0),
    totalAmount: Number(batch.totalAmount || 0),
    remarks: batch.remarks || "",
    isVoided: Boolean(batch.isVoided),

    items: items.map((item) => ({
      _id: item._id?.toString?.() || "",
      purchaseBatchId: item.purchaseBatchId?.toString?.() || "",

      productId:
        item.productId?._id?.toString?.() || item.productId?.toString?.() || "",

      productName: item.productName || item.productId?.name || "",

      buyingPrice: Number(item.buyingPrice || 0),
      quantity: Number(item.quantity || 0),
      subtotal: Number(item.subtotal || 0),
    })),

    createdAt: batch.createdAt
      ? new Date(batch.createdAt).toISOString()
      : undefined,

    updatedAt: batch.updatedAt
      ? new Date(batch.updatedAt).toISOString()
      : undefined,
  };
}

async function reversePurchaseStock(purchaseBatchId: string) {
  const oldItems = await PurchaseItemModel.find({
    purchaseBatchId,
  });

  for (const item of oldItems) {
    const productId = cleanString(String((item as any).productId || ""));

    if (!productId || !isValidObjectId(productId)) continue;

    const product = await ProductModel.findOne({
      _id: productId,
      isActive: true,
    });

    if (!product) continue;

    const quantity = Number((item as any).quantity || 0);
    const previousStock = Number(product.stockPcs || 0);

    product.stockPcs = Math.max(previousStock - quantity, 0);

    await product.save();
  }
}

async function preparePurchaseItems(items: PurchaseItemInput[]) {
  let totalItems = 0;
  let totalAmount = 0;

  const preparedItems = [];

  for (const item of items) {
    const productId = cleanString(item.productId);

    if (!productId || !isValidObjectId(productId)) {
      return {
        error: NextResponse.json(
          {
            success: false,
            message: "Invalid product in purchase item.",
          },
          { status: 400 }
        ),
      };
    }

    const product = await ProductModel.findOne({
      _id: productId,
      isActive: true,
    });

    if (!product) {
      return {
        error: NextResponse.json(
          {
            success: false,
            message: "One selected product was not found.",
          },
          { status: 404 }
        ),
      };
    }

    const buyingPrice = cleanNumber(item.buyingPrice);
    const quantity = cleanNumber(item.quantity);

    if (buyingPrice <= 0) {
      return {
        error: NextResponse.json(
          {
            success: false,
            message: `Buying price must be greater than zero for ${product.name}.`,
          },
          { status: 400 }
        ),
      };
    }

    if (quantity <= 0) {
      return {
        error: NextResponse.json(
          {
            success: false,
            message: `Quantity must be greater than zero for ${product.name}.`,
          },
          { status: 400 }
        ),
      };
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

  return {
    totalItems,
    totalAmount,
    preparedItems,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid purchase batch ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const batch = await PurchaseBatchModel.findOne({
    _id: id,
    isVoided: false,
  }).lean();

  if (!batch) {
    return NextResponse.json(
      {
        success: false,
        message: "Purchase batch not found.",
      },
      { status: 404 }
    );
  }

  const items = await PurchaseItemModel.find({
    purchaseBatchId: id,
  })
    .populate("productId", "name")
    .sort({ createdAt: 1 })
    .lean();

  return NextResponse.json({
    success: true,
    data: serializePurchaseBatch(batch, items),
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid purchase batch ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const batch = await PurchaseBatchModel.findOne({
    _id: id,
    isVoided: false,
  });

  if (!batch) {
    return NextResponse.json(
      {
        success: false,
        message: "Purchase batch not found.",
      },
      { status: 404 }
    );
  }

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

  const prepared = await preparePurchaseItems(items);

  if ("error" in prepared && prepared.error) {
    return prepared.error;
  }

  await reversePurchaseStock(id);

  await PurchaseItemModel.deleteMany({
    purchaseBatchId: id,
  });

  batch.datePurchased = new Date(datePurchased);
  batch.totalItems = prepared.totalItems || 0;
  batch.totalAmount = prepared.totalAmount || 0;
  batch.remarks = remarks;

  if ("updatedBy" in batch) {
    (batch as any).updatedBy = session?.user?.id;
  }

  await batch.save();

  const purchaseItemsToInsert = [];

  for (const item of prepared.preparedItems || []) {
    purchaseItemsToInsert.push({
      purchaseBatchId: batch._id,
      productId: item.productId,
      productName: item.productName,
      buyingPrice: item.buyingPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
    });

    const previousStock = Number(item.product.stockPcs || 0);

    item.product.stockPcs = previousStock + item.quantity;
    item.product.buyingPrice = item.buyingPrice;

    await item.product.save();
  }

  await PurchaseItemModel.insertMany(purchaseItemsToInsert);

  const updatedItems = await PurchaseItemModel.find({
    purchaseBatchId: batch._id,
  })
    .populate("productId", "name")
    .sort({ createdAt: 1 })
    .lean();

  return NextResponse.json({
    success: true,
    message: "Purchase batch updated successfully.",
    data: serializePurchaseBatch(batch.toObject(), updatedItems),
  });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid purchase batch ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const batch = await PurchaseBatchModel.findOne({
    _id: id,
    isVoided: false,
  });

  if (!batch) {
    return NextResponse.json(
      {
        success: false,
        message: "Purchase batch not found.",
      },
      { status: 404 }
    );
  }

  await reversePurchaseStock(id);

  batch.isVoided = true;
  await batch.save();

  return NextResponse.json({
    success: true,
    message: "Purchase batch voided successfully and product stock was reversed.",
  });
}
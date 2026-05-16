// app/api/purchase-batches/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";
import PurchaseBatchModel from "@/models/PurchaseBatch";
import PurchaseItemModel from "@/models/PurchaseItem";

function serializePurchaseBatch(batch: any, items: any[] = []) {
  return {
    _id: batch._id.toString(),
    datePurchased: batch.datePurchased
      ? new Date(batch.datePurchased).toISOString()
      : undefined,
    totalItems: batch.totalItems || 0,
    totalAmount: batch.totalAmount || 0,
    remarks: batch.remarks || "",
    items: items.map((item) => ({
      _id: item._id.toString(),
      bodegaProductId:
        item.bodegaProductId?._id?.toString?.() ||
        item.bodegaProductId?.toString?.(),
      productName: item.productName || item.bodegaProductId?.name || "",
      buyingPrice: item.buyingPrice || 0,
      quantity: item.quantity || 0,
      subtotal: item.subtotal || 0,
    })),
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
    .populate("bodegaProductId", "name")
    .lean();

  return NextResponse.json({
    success: true,
    data: serializePurchaseBatch(batch, items),
  });
}

export async function DELETE(
  _req: NextRequest,
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

  const items = await PurchaseItemModel.find({
    purchaseBatchId: batch._id,
  });

  const reversalTransactions = [];

  for (const item of items) {
    const product = await BodegaProductModel.findOne({
      _id: item.bodegaProductId,
      isActive: true,
    });

    if (!product) continue;

    const previousStock = product.stockQty;
    product.stockQty = Math.max(product.stockQty - item.quantity, 0);

    await product.save();

    reversalTransactions.push({
      bodegaProductId: product._id,
      type: "VOID_REVERSAL",
      quantity: item.quantity,
      previousStock,
      newStock: product.stockQty,
      remarks: `VOID PURCHASE BATCH ${batch._id.toString()}`,
      referenceType: "PURCHASE_BATCH_VOID",
      referenceId: batch._id,
      createdBy: session?.user?.id,
    });
  }

  batch.isVoided = true;
  await batch.save();

  if (reversalTransactions.length > 0) {
    await BodegaStockTransactionModel.insertMany(reversalTransactions);
  }

  return NextResponse.json({
    success: true,
    message: "Purchase batch deleted and stocks reversed successfully.",
  });
}
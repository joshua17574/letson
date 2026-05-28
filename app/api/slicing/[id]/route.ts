import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";

import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";

import SlicingBatchModel from "@/models/SlicingBatch";
import SlicingItemModel from "@/models/SlicingItem";

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
        message: "Invalid slicing batch ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const batch = await SlicingBatchModel.findById(id);

  if (!batch) {
    return NextResponse.json(
      {
        success: false,
        message: "Slicing batch not found.",
      },
      { status: 404 }
    );
  }

  if (batch.isVoided) {
    return NextResponse.json(
      {
        success: false,
        message: "Slicing batch already voided.",
      },
      { status: 400 }
    );
  }

  const items = await SlicingItemModel.find({
    batchId: batch._id,
  });

  const transactions: any[] = [];

  for (const item of items) {
    const [mainProduct, slicedProduct] = await Promise.all([
      BodegaProductModel.findById(item.mainProductId),
      BodegaProductModel.findById(item.slicedProductId),
    ]);

    if (!mainProduct || !slicedProduct) {
      continue;
    }

    // Restore whole chicken stock
    const previousMainStock = Number(mainProduct.stockQty || 0);

    mainProduct.stockQty =
      previousMainStock + Number(item.heads || 0);

    transactions.push({
      bodegaProductId: mainProduct._id,
      type: "VOID_REVERSAL",
      quantity: Number(item.heads || 0),
      previousStock: previousMainStock,
      newStock: mainProduct.stockQty,
      remarks: `VOID SLICING ${batch._id}`,
      referenceType: "SLICING_VOID",
      referenceId: batch._id,
      createdBy: session?.user?.id,
    });

    // Deduct sliced product stock
    const previousSlicedStock =
      Number(slicedProduct.stockQty || 0);

    slicedProduct.stockQty = Math.max(
      previousSlicedStock -
        Number(item.actualSlicedPcs || 0),
      0
    );

    transactions.push({
      bodegaProductId: slicedProduct._id,
      type: "VOID_REVERSAL",
      quantity: Number(item.actualSlicedPcs || 0),
      previousStock: previousSlicedStock,
      newStock: slicedProduct.stockQty,
      remarks: `VOID SLICING ${batch._id}`,
      referenceType: "SLICING_VOID",
      referenceId: batch._id,
      createdBy: session?.user?.id,
    });

    await mainProduct.save();
    await slicedProduct.save();
  }

  if (transactions.length > 0) {
    await BodegaStockTransactionModel.insertMany(
      transactions
    );
  }

  batch.isVoided = true;

  await batch.save();

  return NextResponse.json({
    success: true,
    message: "Slicing batch voided successfully.",
  });
}
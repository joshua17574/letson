// app/api/bodega-products/[id]/stock-in/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanNumber, cleanString } from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";

export async function POST(
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
        message: "Invalid bodega product ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const body = await req.json();

  const quantity = cleanNumber(body.quantity);
  const remarks = cleanString(body.remarks) || "MANUAL BODEGA STOCK IN";

  if (quantity <= 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Quantity must be greater than zero.",
      },
      { status: 400 }
    );
  }

  const product = await BodegaProductModel.findOne({
    _id: id,
    isActive: true,
  });

  if (!product) {
    return NextResponse.json(
      {
        success: false,
        message: "Bodega product not found.",
      },
      { status: 404 }
    );
  }

  const previousStock = product.stockQty;
  product.stockQty += quantity;

  await product.save();

  await BodegaStockTransactionModel.create({
    bodegaProductId: product._id,
    type: "STOCK_IN",
    quantity,
    previousStock,
    newStock: product.stockQty,
    remarks,
    referenceType: "MANUAL_BODEGA_STOCK_IN",
    createdBy: session?.user?.id,
  });

  return NextResponse.json({
    success: true,
    message: "Bodega product stock added successfully.",
    data: {
      _id: product._id.toString(),
      stockQty: product.stockQty,
    },
  });
}
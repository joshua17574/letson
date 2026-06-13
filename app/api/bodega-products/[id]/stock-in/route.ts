// app/api/bodega-products/[id]/stock-in/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { withAuditLog } from "@/lib/audit-log";
import { cleanNumber, cleanString } from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";

async function handlePOST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requirePermission("bodega-products.manage");

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

export const POST = withAuditLog(handlePOST, {
  module: "BODEGA_PRODUCTS",
  action: "STOCK_IN",
  entityType: "BODEGA_PRODUCT",
});

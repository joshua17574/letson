// app/api/inventory/whole-chicken/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString } from "@/lib/crud-utils";
import ProductModel from "@/models/Product";
import InventoryTransactionModel from "@/models/InventoryTransaction";

function getDirection(transaction: any) {
  return Number(transaction.newStock || 0) >= Number(transaction.previousStock || 0)
    ? "IN"
    : "OUT";
}

function getReference(transaction: any) {
  const direction = getDirection(transaction);
  const suffix = transaction._id.toString().slice(-6).toUpperCase();

  return `${direction}-${suffix}`;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid product ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);

  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

  const product = await ProductModel.findOne({
    _id: id,
    isActive: true,
  }).lean();

  if (!product) {
    return NextResponse.json(
      {
        success: false,
        message: "Product not found.",
      },
      { status: 404 }
    );
  }

  const filter: any = {
    productId: id,
  };

  if (dateFrom || dateTo) {
    filter.createdAt = {};

    if (dateFrom) {
      filter.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      filter.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  const transactions = await InventoryTransactionModel.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    success: true,
    product: {
      _id: product._id.toString(),
      name: product.name,
      currentPcs: Number(product.stockPcs || 0),
      currentBags: Number(product.stockBags || 0),
      currentKilos: Number(product.stockKilos || 0),
      lastUpdated: product.updatedAt
        ? new Date(product.updatedAt).toISOString()
        : undefined,
    },
    data: transactions.map((transaction) => {
      const direction = getDirection(transaction);

      return {
        _id: transaction._id.toString(),
        date: transaction.createdAt
          ? new Date(transaction.createdAt).toISOString()
          : undefined,
        type: direction,
        reference: getReference(transaction),
        qtyPcs:
          direction === "IN" && transaction.unit === "PCS"
            ? Number(transaction.quantity || 0)
            : 0,
        qtyBags:
          direction === "IN" && transaction.unit === "BAGS"
            ? Number(transaction.quantity || 0)
            : 0,
        qtyKilos:
          direction === "IN" && transaction.unit === "KILOS"
            ? Number(transaction.quantity || 0)
            : 0,
        qtyOut:
          direction === "OUT" ? Number(transaction.quantity || 0) : 0,
        unit: transaction.unit,
        remarks: transaction.remarks || transaction.referenceType || "",
      };
    }),
  });
}
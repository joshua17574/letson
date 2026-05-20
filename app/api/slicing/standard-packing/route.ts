// app/api/slicing/standard-packing/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanNumber, cleanString } from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import StandardPackingModel from "@/models/StandardPacking";

function serializeStandard(item: any) {
  return {
    _id: item._id.toString(),

    wholeChickenId:
      item.wholeChickenId?._id?.toString?.() ||
      item.wholeChickenId?.toString?.(),
    wholeChickenName: item.wholeChickenId?.name || "",

    productId:
      item.productId?._id?.toString?.() || item.productId?.toString?.(),
    productName: item.productId?.name || "",

    standardPacking: Number(item.standardPacking || 0),
    standardSlice: Number(item.standardSlice || 0),
    chickenSizeType: item.chickenSizeType || "",
    createdAt: item.createdAt
      ? new Date(item.createdAt).toISOString()
      : undefined,
  };
}

export async function GET() {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  void BodegaProductModel;

  const items = await StandardPackingModel.find({
    isActive: true,
  })
    .populate("wholeChickenId", "name")
    .populate("productId", "name")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    success: true,
    data: items.map(serializeStandard),
  });
}

export async function POST(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const body = await req.json();

  const wholeChickenId = cleanString(body.wholeChickenId);
  const productId = cleanString(body.productId);
  const standardPacking = cleanNumber(body.standardPacking);
  const standardSlice = cleanNumber(body.standardSlice);
  const chickenSizeType = cleanString(body.chickenSizeType);

  if (!wholeChickenId || !isValidObjectId(wholeChickenId)) {
    return NextResponse.json(
      {
        success: false,
        message: "Whole chicken bodega product is required.",
      },
      { status: 400 }
    );
  }

  if (!productId || !isValidObjectId(productId)) {
    return NextResponse.json(
      {
        success: false,
        message: "Output bodega product is required.",
      },
      { status: 400 }
    );
  }

  if (standardPacking <= 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Standard packing must be greater than zero.",
      },
      { status: 400 }
    );
  }

  if (standardSlice <= 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Standard slice must be greater than zero.",
      },
      { status: 400 }
    );
  }

  const [wholeChicken, outputProduct] = await Promise.all([
    BodegaProductModel.findOne({
      _id: wholeChickenId,
      isActive: true,
    }),

    BodegaProductModel.findOne({
      _id: productId,
      isActive: true,
    }),
  ]);

  if (!wholeChicken) {
    return NextResponse.json(
      {
        success: false,
        message: "Whole chicken bodega product not found.",
      },
      { status: 404 }
    );
  }

  if (!outputProduct) {
    return NextResponse.json(
      {
        success: false,
        message: "Output bodega product not found.",
      },
      { status: 404 }
    );
  }

  const item = await StandardPackingModel.create({
    wholeChickenId,
    productId,
    standardPacking,
    standardSlice,
    chickenSizeType,
  });

  const populated = await StandardPackingModel.findById(item._id)
    .populate("wholeChickenId", "name")
    .populate("productId", "name")
    .lean();

  return NextResponse.json(
    {
      success: true,
      message: "Standard packing saved successfully.",
      data: serializeStandard(populated),
    },
    { status: 201 }
  );
}
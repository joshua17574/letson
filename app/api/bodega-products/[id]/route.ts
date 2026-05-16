// app/api/bodega-products/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanNumber, cleanString } from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import CategoryModel from "@/models/Category";

function serializeBodegaProduct(product: any) {
  return {
    _id: product._id.toString(),
    name: product.name,
    categoryId: product.categoryId?._id?.toString?.() || product.categoryId?.toString?.() || "",
    categoryName: product.categoryId?.name || "",
    stockQty: product.stockQty || 0,
    buyingPrice: product.buyingPrice || 0,
    sellingPrice: product.sellingPrice || 0,
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
        message: "Invalid bodega product ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const product = await BodegaProductModel.findOne({
    _id: id,
    isActive: true,
  })
    .populate("categoryId", "name")
    .lean();

  if (!product) {
    return NextResponse.json(
      {
        success: false,
        message: "Bodega product not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: serializeBodegaProduct(product),
  });
}

export async function PATCH(
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
        message: "Invalid bodega product ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const body = await req.json();

  const name = cleanString(body.name);
  const categoryId = cleanString(body.categoryId);

  if (!name) {
    return NextResponse.json(
      {
        success: false,
        message: "Bodega product name is required.",
      },
      { status: 400 }
    );
  }

  if (categoryId && !isValidObjectId(categoryId)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid category.",
      },
      { status: 400 }
    );
  }

  if (categoryId) {
    const categoryExists = await CategoryModel.exists({
      _id: categoryId,
      isActive: true,
    });

    if (!categoryExists) {
      return NextResponse.json(
        {
          success: false,
          message: "Category not found.",
        },
        { status: 404 }
      );
    }
  }

  const updatedProduct = await BodegaProductModel.findOneAndUpdate(
    {
      _id: id,
      isActive: true,
    },
    {
      name,
      categoryId: categoryId || undefined,
      stockQty: cleanNumber(body.stockQty),
      buyingPrice: cleanNumber(body.buyingPrice),
      sellingPrice: cleanNumber(body.sellingPrice),
    },
    {
      new: true,
    }
  )
    .populate("categoryId", "name")
    .lean();

  if (!updatedProduct) {
    return NextResponse.json(
      {
        success: false,
        message: "Bodega product not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Bodega product updated successfully.",
    data: serializeBodegaProduct(updatedProduct),
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
        message: "Invalid bodega product ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const deletedProduct = await BodegaProductModel.findOneAndUpdate(
    {
      _id: id,
      isActive: true,
    },
    {
      isActive: false,
    },
    {
      new: true,
    }
  ).lean();

  if (!deletedProduct) {
    return NextResponse.json(
      {
        success: false,
        message: "Bodega product not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Bodega product deleted successfully.",
  });
}
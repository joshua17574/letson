// app/api/bodega-products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId, QueryFilter } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import {
  cleanNumber,
  cleanString,
  escapeRegex,
  getPagination,
} from "@/lib/crud-utils";
import BodegaProductModel, { IBodegaProduct } from "@/models/BodegaProduct";
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
    createdAt: product.createdAt
      ? new Date(product.createdAt).toISOString()
      : undefined,
    updatedAt: product.updatedAt
      ? new Date(product.updatedAt).toISOString()
      : undefined,
  };
}

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const search = cleanString(searchParams.get("search"));
  const categoryId = cleanString(searchParams.get("categoryId"));

  const filter: QueryFilter<IBodegaProduct> = {
    isActive: true,
  };

  if (search) {
    filter.name = {
      $regex: escapeRegex(search),
      $options: "i",
    };
  }

  if (categoryId && isValidObjectId(categoryId)) {
    filter.categoryId = categoryId;
  }

  const [items, total] = await Promise.all([
    BodegaProductModel.find(filter)
      .populate("categoryId", "name")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    BodegaProductModel.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: items.map(serializeBodegaProduct),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}

export async function POST(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

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

  const product = await BodegaProductModel.create({
    name,
    categoryId: categoryId || undefined,
    stockQty: cleanNumber(body.stockQty),
    buyingPrice: cleanNumber(body.buyingPrice),
    sellingPrice: cleanNumber(body.sellingPrice),
  });

  const populatedProduct = await BodegaProductModel.findById(product._id)
    .populate("categoryId", "name")
    .lean();

  return NextResponse.json(
    {
      success: true,
      message: "Bodega product created successfully.",
      data: serializeBodegaProduct(populatedProduct),
    },
    { status: 201 }
  );
}
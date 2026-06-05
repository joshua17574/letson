import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import {
  cleanNumber,
  cleanString,
  escapeRegex,
  getPagination,
} from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import CategoryModel from "@/models/Category";
import StandardPackingModel from "@/models/StandardPacking";

type PopulatedCategory = {
  _id?: Types.ObjectId | string;
  name?: string;
};

type LeanBodegaProduct = {
  _id: Types.ObjectId | string;
  name?: string;
  categoryId?: PopulatedCategory | Types.ObjectId | string | null;
  stockQty?: number;
  buyingPrice?: number;
  sellingPrice?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type LeanStandardPacking = {
  productId?: Types.ObjectId | string | null;
  standardPacking?: number;
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function idToString(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "object" && "toString" in value) return String(value.toString());
  return "";
}

function getCategoryId(category: LeanBodegaProduct["categoryId"]) {
  if (!category) return "";
  if (typeof category === "string" || category instanceof Types.ObjectId) {
    return idToString(category);
  }
  return idToString(category._id);
}

function getCategoryName(category: LeanBodegaProduct["categoryId"]) {
  if (!category || typeof category === "string" || category instanceof Types.ObjectId) {
    return "";
  }
  return category.name || "";
}

function getPackBreakdown(quantityValue: unknown, packSizeValue: unknown) {
  const quantity = Math.max(0, Math.trunc(numberValue(quantityValue)));
  const packSize = Math.max(0, Math.trunc(numberValue(packSizeValue)));

  if (packSize <= 0) {
    return {
      totalPcs: quantity,
      packs: 0,
      loosePcs: quantity,
    };
  }

  const packs = Math.floor(quantity / packSize);
  const loosePcs = quantity - packs * packSize;

  return {
    totalPcs: quantity,
    packs,
    loosePcs,
  };
}

function formatStockDisplay(stockQty: unknown, packSize: number) {
  const breakdown = getPackBreakdown(stockQty, packSize);

  if (packSize <= 0) {
    return `${breakdown.totalPcs.toLocaleString()} pcs total`;
  }

  return `${breakdown.packs.toLocaleString()} packs / ${breakdown.loosePcs.toLocaleString()} pcs loose - ${breakdown.totalPcs.toLocaleString()} pcs total`;
}

function serializeBodegaProduct(product: LeanBodegaProduct | null, packSizeValue = 0) {
  if (!product) return null;

  const packSize = Math.max(0, Math.trunc(numberValue(packSizeValue)));
  const isPackProduct = packSize > 0;
  const stockBreakdown = getPackBreakdown(product.stockQty, packSize);
  const sellingPrice = numberValue(product.sellingPrice);
  const buyingPrice = numberValue(product.buyingPrice);
  const pricePerPack = isPackProduct ? sellingPrice : 0;
  const pricePerPcs = isPackProduct && packSize > 0 ? sellingPrice / packSize : 0;

  return {
    _id: idToString(product._id),
    name: product.name || "",
    categoryId: getCategoryId(product.categoryId),
    categoryName: getCategoryName(product.categoryId),

    // Keep the original field for backward compatibility.
    // For sliced products, stockQty is the raw/base quantity in PCS.
    stockQty: numberValue(product.stockQty),

    // Owner-friendly pack display fields.
    isPackProduct,
    packSize,
    stockPcs: stockBreakdown.totalPcs,
    stockPacks: stockBreakdown.packs,
    stockLoosePcs: stockBreakdown.loosePcs,
    stockDisplay: formatStockDisplay(product.stockQty, packSize),

    buyingPrice,
    sellingPrice,

    // For products with a slicing standard, sellingPrice is treated as price per pack.
    pricePerPack,
    pricePerPcs,

    createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : undefined,
    updatedAt: product.updatedAt ? new Date(product.updatedAt).toISOString() : undefined,
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

  const filter: Record<string, unknown> = {
    isActive: true,
  };

  if (search) {
    filter.name = {
      $regex: escapeRegex(search),
      $options: "i",
    };
  }

  if (categoryId && isValidObjectId(categoryId)) {
    filter.categoryId = new Types.ObjectId(categoryId);
  }

  const [rawItems, total] = await Promise.all([
    BodegaProductModel.find(filter)
      .populate("categoryId", "name")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    BodegaProductModel.countDocuments(filter),
  ]);

  const items = rawItems as LeanBodegaProduct[];
  const productIds = items
    .map((item) => idToString(item._id))
    .filter((id): id is string => Boolean(id) && isValidObjectId(id))
    .map((id) => new Types.ObjectId(id));

  const packSizeByProductId = new Map<string, number>();

  if (productIds.length > 0) {
    const standards = (await StandardPackingModel.find({
      isActive: true,
      productId: { $in: productIds },
    })
      .select("productId standardPacking")
      .lean()) as LeanStandardPacking[];

    for (const standard of standards) {
      const productId = idToString(standard.productId);
      const packSize = Math.max(0, Math.trunc(numberValue(standard.standardPacking)));

      if (productId && packSize > 0 && !packSizeByProductId.has(productId)) {
        packSizeByProductId.set(productId, packSize);
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: items
      .map((item) => serializeBodegaProduct(item, packSizeByProductId.get(idToString(item._id)) || 0))
      .filter(Boolean),
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
      _id: new Types.ObjectId(categoryId),
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
    categoryId: categoryId ? new Types.ObjectId(categoryId) : undefined,
    stockQty: cleanNumber(body.stockQty),
    buyingPrice: cleanNumber(body.buyingPrice),
    sellingPrice: cleanNumber(body.sellingPrice),
  });

  const populatedProduct = (await BodegaProductModel.findById(product._id)
    .populate("categoryId", "name")
    .lean()) as LeanBodegaProduct | null;

  return NextResponse.json(
    {
      success: true,
      message: "Bodega product created successfully.",
      data: serializeBodegaProduct(populatedProduct),
    },
    { status: 201 }
  );
}

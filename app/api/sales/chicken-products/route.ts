import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import BodegaProductModel from "@/models/BodegaProduct";
import CategoryModel from "@/models/Category";
import StandardPackingModel from "@/models/StandardPacking";

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function wholeNumber(value: unknown) {
  return Math.max(0, Math.trunc(numberValue(value)));
}

function getPackBreakdown(stockPcsValue: unknown, packSizeValue: unknown) {
  const stockPcs = wholeNumber(stockPcsValue);
  const packSize = wholeNumber(packSizeValue);

  if (packSize <= 0) {
    return {
      availablePacks: 0,
      loosePcs: stockPcs,
    };
  }

  return {
    availablePacks: Math.floor(stockPcs / packSize),
    loosePcs: stockPcs % packSize,
  };
}

function getCategoryName(product: any) {
  return (
    product.categoryName ||
    product.categoryId?.name ||
    product.category?.name ||
    "NO CATEGORY"
  );
}

function getCategoryId(product: any) {
  return product.categoryId?._id || product.categoryId || undefined;
}

export async function GET(_req: NextRequest) {
  const { response } = await requirePermission("sales.view");
  if (response) return response;

  await dbConnect();
  void CategoryModel;

  const products = await BodegaProductModel.find({ isActive: true })
    .populate("categoryId", "name")
    .sort({ name: 1 })
    .lean();

  const productIds = products.map((product: any) => product._id);

  const standards = await StandardPackingModel.find({
    isActive: true,
    productId: { $in: productIds },
  })
    .select("productId standardPacking standardSlice")
    .lean();

  const packSizeByProductId = new Map<string, number>();

  for (const standard of standards as any[]) {
    const productId = String(standard.productId || "");
    const packSize = wholeNumber(standard.standardPacking);

    if (productId && packSize > 0 && !packSizeByProductId.has(productId)) {
      packSizeByProductId.set(productId, packSize);
    }
  }

  const data = products.map((product: any) => {
    const stockPcs = wholeNumber(product.stockQty || 0);
    const packSize = packSizeByProductId.get(String(product._id)) || 1;
    const { availablePacks, loosePcs } = getPackBreakdown(stockPcs, packSize);
    const pricePerPack = numberValue(product.sellingPrice || 0);
    const pricePerPcs = packSize > 0 ? pricePerPack / packSize : pricePerPack;

    return {
      _id: product._id.toString(),
      productId: product._id.toString(),
      bodegaProductId: product._id.toString(),
      name: product.name || "",
      categoryId: getCategoryId(product)?.toString?.() || "",
      categoryName: getCategoryName(product),
      stockPcs,
      packSize,
      availablePacks,
      loosePcs,
      pricePerPack,
      pricePerPcs,
      isPackBased: packSize > 1,
    };
  });

  return NextResponse.json({
    success: true,
    data,
  });
}

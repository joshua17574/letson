// app/api/sales/chicken-products/route.ts
import { NextResponse } from "next/server";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import BodegaProductModel from "@/models/BodegaProduct";
import StandardPackingModel from "@/models/StandardPacking";

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function wholeNumber(value: unknown) {
  return Math.max(0, Math.trunc(numberValue(value)));
}

export async function GET() {
  const { response } = await requireApiAuth();
  if (response) return response;

  await dbConnect();

  const standards = await StandardPackingModel.find({
    isActive: true,
  })
    .populate({
      path: "productId",
      select: "name categoryId stockQty buyingPrice sellingPrice isActive",
      populate: {
        path: "categoryId",
        select: "name",
      },
    })
    .populate("wholeChickenId", "name")
    .sort({ createdAt: -1 })
    .lean();

  // Register model for populate safety in serverless/runtime reuse.
  void BodegaProductModel;

  const map = new Map<string, any>();

  for (const standard of standards) {
    const product: any = standard.productId;
    if (!product || product.isActive === false) continue;

    const productId = product._id.toString();
    if (map.has(productId)) continue;

    const packSize = wholeNumber(standard.standardPacking);
    if (packSize <= 0) continue;

    const stockPcs = wholeNumber(product.stockQty);
    const availablePacks = Math.floor(stockPcs / packSize);
    const loosePcs = stockPcs - availablePacks * packSize;
    const pricePerPack = numberValue(product.sellingPrice);
    const pricePerPcs = packSize > 0 ? pricePerPack / packSize : 0;

    map.set(productId, {
      _id: productId,
      productId,
      bodegaProductId: productId,
      standardId: standard._id.toString(),
      name: product.name,
      categoryId: product.categoryId?._id?.toString?.() || "",
      categoryName: product.categoryId?.name || "",
      pricePerPack,
      pricePerPcs,
      packSize,
      stockPcs,
      availablePacks,
      loosePcs,
      wholeChickenName: (standard.wholeChickenId as any)?.name || "",
    });
  }

  return NextResponse.json({
    success: true,
    data: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)),
  });
}

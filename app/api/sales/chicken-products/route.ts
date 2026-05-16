// app/api/sales/chicken-products/route.ts
import { NextResponse } from "next/server";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import SlicingStandardModel from "@/models/SlicingStandard";

export async function GET() {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const standards = await SlicingStandardModel.find({
    isActive: true,
  })
    .populate({
      path: "productId",
      select: "name unitPrice stockPcs categoryId isActive",
      populate: {
        path: "categoryId",
        select: "name",
      },
    })
    .populate("wholeChickenId", "name")
    .sort({ createdAt: -1 })
    .lean();

  const map = new Map<string, any>();

  for (const standard of standards) {
    const product: any = standard.productId;

    if (!product || product.isActive === false) continue;

    const productId = product._id.toString();

    if (map.has(productId)) continue;

    const packSize = Number(standard.standardPacking || 0);
    const availablePacks =
      packSize > 0 ? Math.floor(Number(product.stockPcs || 0) / packSize) : 0;

    map.set(productId, {
      _id: productId,
      productId,
      standardId: standard._id.toString(),
      name: product.name,
      categoryId: product.categoryId?._id?.toString?.() || "",
      categoryName: product.categoryId?.name || "",
      pricePerPack: Number(product.unitPrice || 0),
      packSize,
      stockPcs: Number(product.stockPcs || 0),
      availablePacks,
      wholeChickenName: (standard.wholeChickenId as any)?.name || "",
    });
  }

  return NextResponse.json({
    success: true,
    data: Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
  });
}
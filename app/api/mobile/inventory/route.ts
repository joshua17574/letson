// app/api/mobile/inventory/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-auth";
import {
  serializeMobileInventoryItem,
  type CatalogPriceRecord,
} from "@/lib/mobile-pos-contract";
import connectDb from "@/lib/mongodb";
import BodegaProductModel from "@/models/BodegaProduct";
import OutletInventoryModel from "@/models/OutletInventory";
import ProductModel from "@/models/Product";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user, response } = await requireMobileAuth(req, [
    "outlet-inventory.view",
    "sales.view",
  ]);
  if (response) return response;

  if (!user.outlet) {
    return NextResponse.json(
      { success: false, message: "Your account is not assigned to an outlet." },
      { status: 400 }
    );
  }

  await connectDb();

  const items = await OutletInventoryModel.find({
    outletId: user.outlet.id,
    isActive: true,
  })
    .sort({ productName: 1 })
    .lean();

  const inventory = items;
  const bodegaProductIds = inventory
    .filter((item) => item.productSource === "BODEGA")
    .map((item) => item.productId);
  const groceryProductIds = inventory
    .filter((item) => item.productSource === "GROCERY")
    .map((item) => item.productId);
  const [bodegaProducts, groceryProducts] = await Promise.all([
    BodegaProductModel.find({
      _id: { $in: bodegaProductIds },
      isActive: true,
    })
      .select("_id buyingPrice sellingPrice")
      .lean(),
    ProductModel.find({
      _id: { $in: groceryProductIds },
      isActive: true,
    })
      .select("_id buyingPrice unitPrice")
      .lean(),
  ]);
  const catalogByKey = new Map<string, NonNullable<CatalogPriceRecord>>();
  for (const product of bodegaProducts) {
    catalogByKey.set(`BODEGA:${product._id.toString()}`, product);
  }
  for (const product of groceryProducts) {
    catalogByKey.set(`GROCERY:${product._id.toString()}`, product);
  }

  const data = inventory.map((item) =>
    serializeMobileInventoryItem(
      item,
      catalogByKey.get(
        `${item.productSource}:${item.productId?.toString?.() || ""}`,
      ) ?? null,
    ),
  );

  return NextResponse.json({ success: true, outlet: user.outlet, data });
}

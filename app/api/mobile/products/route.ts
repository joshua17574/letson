// app/api/mobile/products/route.ts
//
// Returns the sellable MENU for the cashier's outlet, grouped by category.
// These are retail items (Fried Chicken C10, Coke Sakto, Rice...), each with
// an optional mapping to raw outlet-inventory stock.

import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/mongodb";
import { requireMobileAuth } from "@/lib/mobile-auth";
import OutletMenuItemModel from "@/models/OutletMenuItem";
import OutletInventoryModel from "@/models/OutletInventory";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user, response } = await requireMobileAuth(req, [
    "sales.manage",
    "sales.view",
  ]);
  if (response) return response;

  if (!user.outlet) {
    return NextResponse.json(
      { success: false, message: "Your account is not assigned to an outlet." },
      { status: 400 }
    );
  }

  await dbConnect();

  const items = await OutletMenuItemModel.find({
    outletId: user.outlet.id,
    isActive: true,
  })
    .sort({ category: 1, sortOrder: 1, name: 1 })
    .lean();

  // Pull current raw stock for this outlet so we can show availability of
  // mapped components.
  const inventory = await OutletInventoryModel.find({
    outletId: user.outlet.id,
    isActive: true,
  })
    .select("productSource productId stockQty")
    .lean();

  const stockByKey = new Map<string, number>();
  for (const inv of inventory as any[]) {
    stockByKey.set(
      `${inv.productSource}:${inv.productId?.toString?.()}`,
      Number(inv.stockQty || 0)
    );
  }

  // How many of each menu item can be made from current stock (min across
  // its components). null = unlimited (no stock mapping).
  function makeableCount(components: any[]): number | null {
    if (!components || components.length === 0) return null;
    let min = Infinity;
    for (const c of components) {
      const per = Number(c.qtyPerSale || 0);
      if (per <= 0) continue;
      const have = stockByKey.get(`${c.productSource}:${c.productId?.toString?.()}`) || 0;
      min = Math.min(min, Math.floor(have / per));
    }
    return min === Infinity ? null : min;
  }

  const serialized = (items as any[]).map((it) => ({
    id: it._id.toString(),
    name: it.name || "",
    category: it.category || "Others",
    price: Number(it.price || 0),
    isAvailable: it.isAvailable !== false,
    makeable: makeableCount(it.components), // number or null (unlimited)
    components: (it.components || []).map((c: any) => ({
      productSource: c.productSource,
      productId: c.productId?.toString?.() || "",
      productName: c.productName || "",
      qtyPerSale: Number(c.qtyPerSale || 0),
    })),
  }));

  // Group by category for the UI.
  const byCategory: Record<string, any[]> = {};
  for (const item of serialized) {
    (byCategory[item.category] ||= []).push(item);
  }

  const categories = Object.keys(byCategory).map((name) => ({
    name,
    items: byCategory[name],
  }));

  return NextResponse.json({
    success: true,
    outlet: user.outlet,
    categories,
    items: serialized, // flat list too, for convenience
  });
}

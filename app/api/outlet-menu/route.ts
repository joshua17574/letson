// app/api/outlet-menu/route.ts
//
// Owner-facing management of an outlet's POS menu (web app).
// Cashiers read their menu via /api/mobile/products.

import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { cleanString } from "@/lib/crud-utils";
import OutletMenuItemModel from "@/models/OutletMenuItem";
import OutletModel from "@/models/Outlet";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ComponentInput = {
  productSource?: string;
  productId?: string;
  productName?: string;
  qtyPerSale?: number;
};

function serialize(item: any) {
  return {
    _id: item._id.toString(),
    outletId: item.outletId?.toString?.() || "",
    name: item.name || "",
    category: item.category || "Others",
    price: Number(item.price || 0),
    sortOrder: Number(item.sortOrder || 0),
    isAvailable: item.isAvailable !== false,
    components: (item.components || []).map((c: any) => ({
      productSource: c.productSource,
      productId: c.productId?.toString?.() || "",
      productName: c.productName || "",
      qtyPerSale: Number(c.qtyPerSale || 0),
    })),
  };
}

function cleanComponents(input: unknown): ComponentInput[] {
  if (!Array.isArray(input)) return [];
  const out: ComponentInput[] = [];
  for (const raw of input) {
    const source = String((raw as any)?.productSource || "").toUpperCase();
    const productId = cleanString((raw as any)?.productId);
    const qtyPerSale = Number((raw as any)?.qtyPerSale);
    if ((source !== "BODEGA" && source !== "GROCERY") || !isValidObjectId(productId)) continue;
    out.push({
      productSource: source,
      productId,
      productName: cleanString((raw as any)?.productName),
      qtyPerSale: Number.isFinite(qtyPerSale) && qtyPerSale > 0 ? qtyPerSale : 1,
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { response } = await requirePermission(["outlets.view", "outlets.manage", "outlet-inventory.view"]);
  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const outletId = cleanString(searchParams.get("outletId"));

  if (!outletId || !isValidObjectId(outletId)) {
    return NextResponse.json(
      { success: false, message: "A valid outletId is required." },
      { status: 400 }
    );
  }

  const items = await OutletMenuItemModel.find({ outletId, isActive: true })
    .sort({ category: 1, sortOrder: 1, name: 1 })
    .lean();

  return NextResponse.json({
    success: true,
    data: (items as any[]).map(serialize),
  });
}

export async function POST(req: NextRequest) {
  const { response, session } = await requirePermission(["outlets.manage", "outlet-inventory.manage"]);
  if (response) return response;

  await dbConnect();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 });
  }

  const outletId = cleanString(body?.outletId);
  const name = cleanString(body?.name);
  const category = cleanString(body?.category) || "Others";
  const price = Number(body?.price);

  if (!isValidObjectId(outletId)) {
    return NextResponse.json({ success: false, message: "A valid outlet is required." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ success: false, message: "Item name is required." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ success: false, message: "A valid price is required." }, { status: 400 });
  }

  const outlet = await OutletModel.findById(outletId).lean();
  if (!outlet) {
    return NextResponse.json({ success: false, message: "Outlet not found." }, { status: 404 });
  }

  const item: any = await (OutletMenuItemModel as any).create({
    outletId,
    name,
    category,
    price,
    sortOrder: Number(body?.sortOrder || 0),
    isAvailable: body?.isAvailable !== false,
    components: cleanComponents(body?.components),
    createdBy: session?.user?.id,
  });

  return NextResponse.json(
    { success: true, message: "Menu item added.", data: serialize(item.toObject()) },
    { status: 201 }
  );
}

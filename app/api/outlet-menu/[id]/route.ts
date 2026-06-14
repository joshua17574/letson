// app/api/outlet-menu/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { cleanString } from "@/lib/crud-utils";
import OutletMenuItemModel from "@/models/OutletMenuItem";

export const dynamic = "force-dynamic";

type ComponentInput = {
  productSource?: string;
  productId?: string;
  productName?: string;
  qtyPerSale?: number;
};

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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission(["outlets.manage", "outlet-inventory.manage"]);
  if (response) return response;

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: "Invalid item ID." }, { status: 400 });
  }

  await dbConnect();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 });
  }

  const item = await OutletMenuItemModel.findById(id);
  if (!item || item.isActive === false) {
    return NextResponse.json({ success: false, message: "Menu item not found." }, { status: 404 });
  }

  if (body?.name !== undefined) item.name = cleanString(body.name) || item.name;
  if (body?.category !== undefined) item.category = cleanString(body.category) || "Others";
  if (body?.price !== undefined) {
    const price = Number(body.price);
    if (Number.isFinite(price) && price >= 0) item.price = price;
  }
  if (body?.sortOrder !== undefined) item.sortOrder = Number(body.sortOrder || 0);
  if (body?.isAvailable !== undefined) item.isAvailable = Boolean(body.isAvailable);
  if (body?.components !== undefined) item.components = cleanComponents(body.components) as any;

  await item.save();

  return NextResponse.json({ success: true, message: "Menu item updated." });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission(["outlets.manage", "outlet-inventory.manage"]);
  if (response) return response;

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: "Invalid item ID." }, { status: 400 });
  }

  await dbConnect();

  // Soft delete so historical sale references stay intact.
  const item = await OutletMenuItemModel.findByIdAndUpdate(id, { isActive: false });
  if (!item) {
    return NextResponse.json({ success: false, message: "Menu item not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: "Menu item removed." });
}

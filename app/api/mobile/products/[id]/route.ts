import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-auth";
import { parseMobileMenuPriceUpdateRequest } from "@/lib/mobile-pos-contract";
import dbConnect from "@/lib/mongodb";
import OutletMenuItemModel from "@/models/OutletMenuItem";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireMobileAuth(req, ["sales.manage"]);
  if (response) return response;
  if (!user.outlet) {
    return NextResponse.json(
      { success: false, message: "Your account is not assigned to an outlet." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid menu item ID." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400 },
    );
  }
  const parsed = parseMobileMenuPriceUpdateRequest(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, message: parsed.message },
      { status: 400 },
    );
  }

  await dbConnect();
  const item = await OutletMenuItemModel.findOne({
    _id: id,
    outletId: user.outlet.id,
    isActive: true,
  });
  if (!item) {
    return NextResponse.json(
      { success: false, message: "Menu item not found." },
      { status: 404 },
    );
  }

  item.price = parsed.value.price;
  await item.save();

  return NextResponse.json({
    success: true,
    message: "Menu price updated.",
    item: {
      id: item._id.toString(),
      name: item.name,
      category: item.category,
      price: Number(item.price),
      isAvailable: item.isAvailable !== false,
    },
  });
}

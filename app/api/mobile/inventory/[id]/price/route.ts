import mongoose, { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-auth";
import {
  parseMobilePriceUpdateRequest,
  serializeMobileInventoryItem,
} from "@/lib/mobile-pos-contract";
import connectDb from "@/lib/mongodb";
import AuditLogModel from "@/models/AuditLog";
import BodegaProductModel from "@/models/BodegaProduct";
import OutletInventoryModel from "@/models/OutletInventory";
import ProductModel from "@/models/Product";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireMobileAuth(req, [
    "outlet-inventory.manage",
    "sales.manage",
  ]);
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
      { success: false, message: "Invalid outlet inventory ID." },
      { status: 400 },
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400 },
    );
  }
  const parsed = parseMobilePriceUpdateRequest(requestBody);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, message: parsed.message },
      { status: 400 },
    );
  }

  await connectDb();
  const mongoSession = await mongoose.startSession();
  try {
    const result = await mongoSession.withTransaction(async () => {
      const inventory = await OutletInventoryModel.findOne({
        _id: id,
        outletId: user.outlet!.id,
        isActive: true,
      }).session(mongoSession);
      if (!inventory) {
        throw new PriceUpdateError(404, "Outlet stock product was not found.");
      }

      const category = String(inventory.categoryName || "")
        .trim()
        .toUpperCase();
      if (category !== "CHICKEN" && category !== "WC") {
        throw new PriceUpdateError(
          400,
          "Only Chicken products can be repriced in Outlet Stock.",
        );
      }

      const previousSellingPriceOverride = inventory.sellingPriceOverride;
      const packSize = Math.max(0, Math.trunc(Number(inventory.packSize || 0)));
      const catalogSellingPrice =
        inventory.productSource === "BODEGA" && packSize > 0
          ? parsed.value.sell * packSize
          : parsed.value.sell;

      const catalog =
        inventory.productSource === "BODEGA"
          ? await BodegaProductModel.findOne({
              _id: inventory.productId,
              isActive: true,
            }).session(mongoSession)
          : await ProductModel.findOne({
              _id: inventory.productId,
              isActive: true,
            }).session(mongoSession);
      if (!catalog) {
        throw new PriceUpdateError(
          409,
          "The linked Chicken product is no longer available.",
        );
      }

      const actorId = new mongoose.Types.ObjectId(user.id);
      inventory.sellingPriceOverride = catalogSellingPrice;
      inventory.updatedBy = actorId;
      const updatedInventory = await inventory.save({ session: mongoSession });

      await AuditLogModel.create(
        [
          {
            outletId: inventory.outletId,
            module: "OUTLET INVENTORY",
            action: "UPDATE PRICE",
            entityType: "OUTLET_INVENTORY",
            entityId: inventory._id,
            oldValue: {
              sellingPriceOverride: previousSellingPriceOverride,
            },
            newValue: {
              sellingPriceOverride: catalogSellingPrice,
              pieceSellingPrice: parsed.value.sell,
            },
            remarks: "MOBILE CHICKEN PRICE UPDATE",
            sourceChannel: "FLUTTER",
            createdBy: actorId,
          },
        ],
        { session: mongoSession },
      );
      return {
        inventory: updatedInventory.toObject(),
        catalog: catalog.toObject(),
      };
    });
    if (!result) {
      throw new Error("Price update transaction did not return a result.");
    }

    return NextResponse.json({
      success: true,
      message: "Selling price updated.",
      data: serializeMobileInventoryItem(result.inventory, result.catalog),
    });
  } catch (error) {
    if (error instanceof PriceUpdateError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Unable to update the selling price." },
      { status: 500 },
    );
  } finally {
    await mongoSession.endSession();
  }
}

class PriceUpdateError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

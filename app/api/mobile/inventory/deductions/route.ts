import mongoose, { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-auth";
import { parseMobileInventoryDeductionRequest } from "@/lib/mobile-pos-contract";
import connectDb from "@/lib/mongodb";
import AuditLogModel from "@/models/AuditLog";
import OutletInventoryModel from "@/models/OutletInventory";
import OutletStockTransactionModel from "@/models/OutletStockTransaction";

export const dynamic = "force-dynamic";

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type DeductedItem = {
  inventoryId: string;
  productName: string;
  categoryName: string;
  qty: number;
  previousStock: number;
  newStock: number;
};

export async function POST(req: NextRequest) {
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

  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = parseMobileInventoryDeductionRequest(requestBody);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, message: parsed.message },
      { status: 400 },
    );
  }
  if (parsed.value.items.some((item) => !isValidObjectId(item.inventoryId))) {
    return NextResponse.json(
      { success: false, message: "Invalid outlet inventory ID." },
      { status: 400 },
    );
  }

  await connectDb();

  const mongoSession = await mongoose.startSession();
  try {
    const deductionId = new mongoose.Types.ObjectId();
    const createdAt = new Date();
    const deductedItems: DeductedItem[] = [];

    await mongoSession.withTransaction(async () => {
      deductedItems.length = 0;
      for (const item of parsed.value.items) {
        const inventory = await OutletInventoryModel.findOneAndUpdate(
          {
            _id: item.inventoryId,
            outletId: user.outlet!.id,
            isActive: true,
            categoryName: /^INGREDIENTS$/i,
            stockQty: { $gte: item.qty },
          },
          {
            $inc: { stockQty: -item.qty },
            $set: { updatedBy: user.id },
          },
          { new: true, session: mongoSession },
        );

        if (!inventory) {
          const existing = await OutletInventoryModel.findOne({
            _id: item.inventoryId,
            outletId: user.outlet!.id,
            isActive: true,
          }).session(mongoSession);

          if (!existing) {
            throw new ApiError(404, "Outlet ingredient not found. Refresh and try again.");
          }
          if (String(existing.categoryName || "").toUpperCase() !== "INGREDIENTS") {
            throw new ApiError(400, `${existing.productName} is not an ingredient.`);
          }
          throw new ApiError(
            409,
            `Not enough stock for ${existing.productName}. Refresh and try again.`,
          );
        }

        const newStock = Number(inventory.stockQty || 0);
        const previousStock = newStock + item.qty;
        deductedItems.push({
          inventoryId: inventory._id.toString(),
          productName: inventory.productName,
          categoryName: inventory.categoryName || "INGREDIENTS",
          qty: item.qty,
          previousStock,
          newStock,
        });

        await OutletStockTransactionModel.create(
          [
            {
              outletId: inventory.outletId,
              outletInventoryId: inventory._id,
              productSource: inventory.productSource,
              productId: inventory.productId,
              productName: inventory.productName,
              transactionDate: createdAt,
              type: "STOCK_OUT",
              quantity: item.qty,
              previousStock,
              newStock,
              referenceType: "MOBILE_INGREDIENT_DEDUCTION",
              referenceId: deductionId,
              sourceChannel: "FLUTTER",
              remarks:
                parsed.value.remarks || "MOBILE INGREDIENT DEDUCTION",
              createdBy: user.id,
            },
          ],
          { session: mongoSession },
        );

        await AuditLogModel.create(
          [
            {
              outletId: inventory.outletId,
              module: "OUTLET INVENTORY",
              action: "DEDUCT",
              entityType: "OUTLET_INVENTORY",
              entityId: inventory._id,
              oldValue: { stockQty: previousStock },
              newValue: { stockQty: newStock },
              remarks:
                parsed.value.remarks || "MOBILE INGREDIENT DEDUCTION",
              sourceChannel: "FLUTTER",
              createdBy: user.id,
            },
          ],
          { session: mongoSession },
        );
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: "Stock deducted.",
        deduction: {
          id: deductionId.toString(),
          createdAt: createdAt.toISOString(),
          items: deductedItems,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Unable to deduct outlet stock." },
      { status: 500 },
    );
  } finally {
    await mongoSession.endSession();
  }
}

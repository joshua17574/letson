import mongoose, { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-auth";
import { mobileOutletSaleFilter } from "@/lib/mobile-outlet-payments";
import { parseMobileSaleVoidRequest } from "@/lib/mobile-pos-contract";
import connectDb from "@/lib/mongodb";
import AuditLogModel from "@/models/AuditLog";
import OutletInventoryModel from "@/models/OutletInventory";
import OutletStockTransactionModel from "@/models/OutletStockTransaction";
import SaleModel from "@/models/Sale";

export const dynamic = "force-dynamic";

class VoidSaleError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireMobileAuth(req, "sales.manage");
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
      { success: false, message: "Invalid sale ID." },
      { status: 400 },
    );
  }

  let requestBody: unknown = {};
  try {
    const rawBody = await req.text();
    requestBody = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400 },
    );
  }
  const parsed = parseMobileSaleVoidRequest(requestBody);
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
      const saleFilter = mobileOutletSaleFilter(user.outlet!.id, id);
      const sale = await SaleModel.findOneAndUpdate(
        { ...saleFilter, isVoided: { $ne: true } },
        { $set: { isVoided: true, status: "VOIDED", balance: 0 } },
        { new: true, session: mongoSession },
      );

      if (!sale) {
        const existing = await SaleModel.findOne(saleFilter)
          .select("isVoided status receiptNumber")
          .session(mongoSession)
          .lean();
        if (!existing) {
          throw new VoidSaleError(404, "Mobile sale was not found.");
        }
        if (existing.isVoided) {
          return {
            id,
            receiptNumber: existing.receiptNumber,
            alreadyVoided: true,
            restoredItems: 0,
          };
        }
        throw new VoidSaleError(409, "This sale could not be voided. Try again.");
      }

      const stockTransactions = await OutletStockTransactionModel.find({
        outletId: user.outlet!.id,
        referenceType: "MOBILE_SALE",
        referenceId: sale._id,
        type: "SALE",
      }).session(mongoSession);

      let restoredItems = 0;
      for (const transaction of stockTransactions) {
        const quantity = Number(transaction.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;

        const inventory = await OutletInventoryModel.findOneAndUpdate(
          {
            _id: transaction.outletInventoryId,
            outletId: user.outlet!.id,
          },
          {
            $inc: { stockQty: quantity },
            $set: { updatedBy: user.id },
          },
          { new: true, session: mongoSession },
        );
        if (!inventory) {
          throw new VoidSaleError(
            409,
            `Unable to restore stock for ${transaction.productName}.`,
          );
        }

        const newStock = Number(inventory.stockQty || 0);
        await OutletStockTransactionModel.create(
          [
            {
              outletId: user.outlet!.id,
              outletInventoryId: inventory._id,
              productSource: transaction.productSource,
              productId: transaction.productId,
              productName: transaction.productName,
              transactionDate: new Date(),
              type: "VOID",
              quantity,
              previousStock: newStock - quantity,
              newStock,
              referenceType: "MOBILE_SALE",
              referenceId: sale._id,
              sourceChannel: "FLUTTER",
              remarks: `VOID SALE ${sale.receiptNumber}`,
              createdBy: user.id,
            },
          ],
          { session: mongoSession },
        );
        restoredItems += 1;
      }

      await AuditLogModel.create(
        [
          {
            outletId: user.outlet!.id,
            module: "SALES",
            action: "VOID",
            entityType: "SALE",
            entityId: sale._id,
            oldValue: { isVoided: false, status: "PAID" },
            newValue: {
              isVoided: true,
              status: "VOIDED",
              refunded: parsed.value.refunded,
            },
            remarks: parsed.value.reason || `VOID SALE ${sale.receiptNumber}`,
            sourceChannel: "FLUTTER",
            createdBy: user.id,
          },
        ],
        { session: mongoSession },
      );

      return {
        id: sale._id.toString(),
        receiptNumber: sale.receiptNumber,
        alreadyVoided: false,
        restoredItems,
      };
    });

    if (!result) {
      throw new Error("Void transaction did not return a result.");
    }
    return NextResponse.json({
      success: true,
      message: result.alreadyVoided
        ? "Sale was already voided."
        : "Sale voided and outlet stock restored.",
      sale: {
        id: result.id,
        receiptNumber: result.receiptNumber,
        isVoided: true,
        status: "VOIDED",
      },
      restoredItems: result.restoredItems,
    });
  } catch (error) {
    if (error instanceof VoidSaleError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Unable to void the sale." },
      { status: 500 },
    );
  } finally {
    await mongoSession.endSession();
  }
}

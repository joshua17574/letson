import mongoose, { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-auth";
import {
  mobileExpenseDeleteFilter,
  mobileExpenseOutletPattern,
} from "@/lib/mobile-pos-contract";
import connectDb from "@/lib/mongodb";
import AuditLogModel from "@/models/AuditLog";
import ExpenseModel from "@/models/Expense";

export const dynamic = "force-dynamic";

class DeleteExpenseError extends Error {
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
  const { user, response } = await requireMobileAuth(
    req,
    "expenses-bodega.manage",
  );
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
      { success: false, message: "Invalid expense ID." },
      { status: 400 },
    );
  }

  await connectDb();
  const mongoSession = await mongoose.startSession();
  try {
    const result = await mongoSession.withTransaction(async () => {
      const expense = await ExpenseModel.findOneAndUpdate(
        mobileExpenseDeleteFilter(user.outlet!.id, id),
        { $set: { isActive: false } },
        { new: true, session: mongoSession },
      );

      if (!expense) {
        const existing = await ExpenseModel.findOne({
          _id: id,
          remarks: {
            $regex: mobileExpenseOutletPattern(user.outlet!.id),
          },
        })
          .select("isActive")
          .session(mongoSession)
          .lean();
        if (!existing) {
          throw new DeleteExpenseError(404, "Mobile expense was not found.");
        }
        if (existing.isActive === false) {
          return { id, alreadyDeleted: true };
        }
        throw new DeleteExpenseError(
          409,
          "This expense could not be deleted. Try again.",
        );
      }

      await AuditLogModel.create(
        [
          {
            outletId: user.outlet!.id,
            module: "EXPENSES",
            action: "DELETE",
            entityType: "EXPENSE",
            entityId: expense._id,
            oldValue: {
              name: expense.name,
              amount: expense.amount,
              isActive: true,
            },
            newValue: { isActive: false },
            remarks: "MOBILE EXPENSE DELETE",
            sourceChannel: "FLUTTER",
            createdBy: user.id,
          },
        ],
        { session: mongoSession },
      );

      return { id: expense._id.toString(), alreadyDeleted: false };
    });

    if (!result) {
      throw new Error("Expense deletion did not return a result.");
    }
    return NextResponse.json({
      success: true,
      message: result.alreadyDeleted
        ? "Expense was already deleted."
        : "Expense deleted.",
      expense: { id: result.id, isActive: false },
    });
  } catch (error) {
    if (error instanceof DeleteExpenseError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Unable to delete the expense." },
      { status: 500 },
    );
  } finally {
    await mongoSession.endSession();
  }
}

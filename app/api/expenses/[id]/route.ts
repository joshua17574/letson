// app/api/expenses/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanNumber, cleanString } from "@/lib/crud-utils";
import ExpenseModel, { ExpenseType } from "@/models/Expense";

const expenseTypes: ExpenseType[] = [
  "DELIVERY_EXPENSES",
  "CLEANING_SUPPLIES",
  "TRANSPORTATION_EXPENSES",
  "MARINATE_EXPENSES",
  "OFFICE_SUPPLIES",
  "REPAIR_AND_MAINTENANCE",
  "SALARIES",
  "INCENTIVES_AND_ALLOWANCES",
  "OTHERS",
];


function isExpenseType(value: string): value is ExpenseType {
  return expenseTypes.includes(value as ExpenseType);
}

function serializeExpense(expense: any) {
  return {
    _id: expense._id.toString(),
    name: expense.name,
    type: expense.type,
    expenseDate: expense.expenseDate
      ? new Date(expense.expenseDate).toISOString()
      : undefined,
    amount: Number(expense.amount || 0),
    remarks: expense.remarks || "",
  };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid expense ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const body = await req.json();

  const name = cleanString(body.name);
  const typeInput = cleanString(body.type).toUpperCase();
  const expenseDate = cleanString(body.expenseDate);
  const amount = cleanNumber(body.amount);
  const remarks = cleanString(body.remarks);

  if (!name) {
    return NextResponse.json(
      {
        success: false,
        message: "Expense name is required.",
      },
      { status: 400 }
    );
  }

  if (!expenseDate) {
    return NextResponse.json(
      {
        success: false,
        message: "Expense date is required.",
      },
      { status: 400 }
    );
  }

  if (amount <= 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Amount must be greater than zero.",
      },
      { status: 400 }
    );
  }

  const expense = await ExpenseModel.findOneAndUpdate(
    {
      _id: id,
      isActive: true,
    },
    {
      name,
      type: isExpenseType(typeInput) ? typeInput : "OTHERS",
      expenseDate: new Date(expenseDate),
      amount,
      remarks,
    },
    {
      new: true,
    }
  );

  if (!expense) {
    return NextResponse.json(
      {
        success: false,
        message: "Expense not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Expense updated successfully.",
    data: serializeExpense(expense.toObject()),
  });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid expense ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const expense = await ExpenseModel.findOneAndUpdate(
    {
      _id: id,
      isActive: true,
    },
    {
      isActive: false,
    }
  );

  if (!expense) {
    return NextResponse.json(
      {
        success: false,
        message: "Expense not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Expense deleted successfully.",
  });
}
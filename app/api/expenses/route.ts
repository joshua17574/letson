// app/api/expenses/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { QueryFilter } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import {
  cleanNumber,
  cleanString,
  escapeRegex,
  getPagination,
} from "@/lib/crud-utils";
import ExpenseModel, { ExpenseType, IExpense } from "@/models/Expense";


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

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const search = cleanString(searchParams.get("search"));
  const type = cleanString(searchParams.get("type")).toUpperCase();
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

  const filter: QueryFilter<IExpense> = {
    isActive: true,
  };

  if (search) {
    filter.name = {
      $regex: escapeRegex(search),
      $options: "i",
    };
  }

  if (isExpenseType(type)) {
    filter.type = type;
  }

  if (dateFrom || dateTo) {
    filter.expenseDate = {};

    if (dateFrom) {
      filter.expenseDate.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      filter.expenseDate.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  const [items, total, summary] = await Promise.all([
    ExpenseModel.find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    ExpenseModel.countDocuments(filter),

    ExpenseModel.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: "$amount",
          },
          rows: {
            $sum: 1,
          },
        },
      },
    ]),
  ]);

  return NextResponse.json({
    success: true,
    data: items.map(serializeExpense),
    summary: {
      rows: summary[0]?.rows || 0,
      totalAmount: summary[0]?.totalAmount || 0,
    },
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}

export async function POST(req: NextRequest) {
  const { response, session } = await requireApiAuth();

  if (response) return response;

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

  const expense = await ExpenseModel.create({
    name,
    type: isExpenseType(typeInput) ? typeInput : "OTHERS",
    expenseDate: new Date(expenseDate),
    amount,
    remarks,
    createdBy: session?.user?.id,
  });

  return NextResponse.json(
    {
      success: true,
      message: "Expense saved successfully.",
      data: serializeExpense(expense.toObject()),
    },
    { status: 201 }
  );
}
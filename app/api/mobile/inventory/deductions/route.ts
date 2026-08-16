import mongoose, { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-auth";
import {
  parseMobileDeductionHistoryQuery,
  parseMobileInventoryDeductionRequest,
  normalizeMobileInventoryCategory,
} from "@/lib/mobile-pos-contract";
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

type DeductionHistoryGroup = {
  _id: { toString(): string };
  createdAt: Date;
  remarks?: string;
  items: DeductedItem[];
};

type DeductionHistoryFacet = {
  data: DeductionHistoryGroup[];
  meta: Array<{ total: number }>;
};

export async function GET(req: NextRequest) {
  const { user, response } = await requireMobileAuth(req, [
    "outlet-inventory.view",
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

  const params = req.nextUrl.searchParams;
  const parsed = parseMobileDeductionHistoryQuery({
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, message: parsed.message },
      { status: 400 },
    );
  }

  await connectDb();
  const { from, toExclusive, page, pageSize } = parsed.value;
  const transactionDate = {
    ...(from ? { $gte: from } : {}),
    ...(toExclusive ? { $lt: toExclusive } : {}),
  };
  const [facet] =
    await OutletStockTransactionModel.aggregate<DeductionHistoryFacet>([
      {
        $match: {
          outletId: new mongoose.Types.ObjectId(user.outlet.id),
          type: "STOCK_OUT",
          referenceType: "MOBILE_INGREDIENT_DEDUCTION",
          referenceId: { $ne: null },
          ...(Object.keys(transactionDate).length > 0
            ? { transactionDate }
            : {}),
        },
      },
      { $sort: { transactionDate: -1, _id: -1 } },
      {
        $group: {
          _id: "$referenceId",
          createdAt: { $first: "$transactionDate" },
          remarks: { $first: "$remarks" },
          items: {
            $push: {
              inventoryId: { $toString: "$outletInventoryId" },
              productName: "$productName",
              categoryName: { $ifNull: ["$categoryName", "INGREDIENTS"] },
              qty: "$quantity",
              previousStock: "$previousStock",
              newStock: "$newStock",
            },
          },
        },
      },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          data: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
          meta: [{ $count: "total" }],
        },
      },
    ]);
  const total = facet?.meta[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    success: true,
    data: (facet?.data ?? []).map((deduction) => ({
      id: deduction._id.toString(),
      createdAt: deduction.createdAt.toISOString(),
      remarks: deduction.remarks || "",
      totalQty: deduction.items.reduce(
        (sum, item) => sum + Number(item.qty || 0),
        0,
      ),
      items: deduction.items,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  });
}

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
            categoryName: /^(CHICKEN|DRINKS?|BEVERAGES?|INGREDIENTS?)$/i,
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
            throw new ApiError(
              404,
              "Outlet stock item not found. Refresh and try again.",
            );
          }
          if (!normalizeMobileInventoryCategory(existing.categoryName)) {
            throw new ApiError(
              400,
              `${existing.productName} is not available for stock deduction.`,
            );
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
          categoryName:
            normalizeMobileInventoryCategory(inventory.categoryName) ||
            "INGREDIENTS",
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
              categoryName:
                normalizeMobileInventoryCategory(inventory.categoryName) ||
                "INGREDIENTS",
              transactionDate: createdAt,
              type: "STOCK_OUT",
              quantity: item.qty,
              previousStock,
              newStock,
              referenceType: "MOBILE_INGREDIENT_DEDUCTION",
              referenceId: deductionId,
              sourceChannel: "FLUTTER",
              remarks: parsed.value.remarks || "MOBILE INGREDIENT DEDUCTION",
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
              remarks: parsed.value.remarks || "MOBILE INGREDIENT DEDUCTION",
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

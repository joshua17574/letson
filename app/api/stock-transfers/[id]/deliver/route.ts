// app/api/stock-transfers/[id]/deliver/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { withAuditLog } from "@/lib/audit-log";
import StockTransferModel from "@/models/StockTransfer";

export const dynamic = "force-dynamic";

async function handlePOST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission([
    "stock-transfers.confirm",
    "stock-transfers.manage",
  ]);
  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid transfer ID." },
      { status: 400 }
    );
  }

  await dbConnect();

  const transfer = await StockTransferModel.findOneAndUpdate(
    { _id: id, status: "IN_TRANSIT" },
    { $set: { status: "DELIVERED", deliveredAt: new Date() } },
    { new: true }
  );

  if (!transfer) {
    const exists = await StockTransferModel.exists({ _id: id });

    return NextResponse.json(
      {
        success: false,
        message: exists
          ? "Only in-transit transfers can be marked as delivered."
          : "Stock transfer not found.",
      },
      { status: exists ? 400 : 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Transfer ${transfer.transferNumber} marked as delivered. Count the items and confirm the received quantities.`,
  });
}

export const POST = withAuditLog(handlePOST, {
  module: "STOCK_TRANSFERS",
  action: "DELIVER",
  entityType: "STOCK_TRANSFER",
});

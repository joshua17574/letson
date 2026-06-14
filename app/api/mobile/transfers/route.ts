// app/api/mobile/transfers/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-auth";
import connectDb from "@/lib/mongodb";
import StockTransferModel from "@/models/StockTransfer";

export const dynamic = "force-dynamic";

// GET /api/mobile/transfers?status=incoming   -> transfers awaiting receipt
// GET /api/mobile/transfers                   -> recent transfers to this outlet
export async function GET(req: NextRequest) {
  const { user, response } = await requireMobileAuth(req, [
    "stock-transfers.confirm",
    "stock-transfers.view",
  ]);
  if (response) return response;

  if (!user.outlet) {
    return NextResponse.json(
      { success: false, message: "Your account is not assigned to an outlet." },
      { status: 400 }
    );
  }

  await connectDb();

  const { searchParams } = new URL(req.url);
  const incomingOnly = searchParams.get("status") === "incoming";

  const filter: Record<string, unknown> = { outletId: user.outlet.id };
  if (incomingOnly) {
    filter.status = { $in: ["IN_TRANSIT", "DELIVERED"] };
  }

  const transfers = await StockTransferModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const data = (transfers as any[]).map((t) => ({
    id: t._id.toString(),
    transferNumber: t.transferNumber || "",
    status: t.status,
    totalItems: Number(t.totalItems || 0),
    totalQty: Number(t.totalQty || 0),
    transferDate: t.transferDate ? new Date(t.transferDate).toISOString() : null,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
  }));

  return NextResponse.json({ success: true, data });
}

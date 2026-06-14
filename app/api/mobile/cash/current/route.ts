// app/api/mobile/cash/current/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-auth";
import connectDb from "@/lib/mongodb";
import CashShiftModel from "@/models/CashShift";
import { sumShiftSales, sumShiftExpenses } from "@/lib/cash-shift";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user, response } = await requireMobileAuth(req, ["cash.manage", "sales.view"]);
  if (response) return response;

  await connectDb();

  const shift = await CashShiftModel.findOne({
    cashierId: user.id,
    status: "OPEN",
  }).lean<any>();

  if (!shift) {
    return NextResponse.json({ success: true, shift: null });
  }

  const { total: cashSales, count: salesCount } = await sumShiftSales(
    shift._id.toString()
  );
  const { total: cashExpenses } = await sumShiftExpenses(shift._id.toString());

  const expectedCash =
    Number(shift.openingFloat || 0) + cashSales - cashExpenses;

  return NextResponse.json({
    success: true,
    shift: {
      id: shift._id.toString(),
      openingFloat: Number(shift.openingFloat || 0),
      openedAt: shift.openedAt ? new Date(shift.openedAt).toISOString() : null,
      cashSales,
      cashExpenses,
      salesCount,
      expectedCash,
    },
  });
}

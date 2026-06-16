// app/api/outlet-summary/route.ts
//
// Owner-facing per-outlet performance: sales, expenses, and net for each
// outlet over a date range. Mobile sales/expenses are tagged in `remarks`
// with `OUTLET:<id>`, so we aggregate by that tag.

import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { cleanString } from "@/lib/crud-utils";
import OutletModel from "@/models/Outlet";
import SaleModel from "@/models/Sale";
import ExpenseModel from "@/models/Expense";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseRange(searchParams: URLSearchParams) {
  const preset = cleanString(searchParams.get("preset")).toLowerCase();
  const now = new Date();

  // Default: this month.
  let start = new Date(now.getFullYear(), now.getMonth(), 1);
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (preset === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (preset === "week") {
    const day = now.getDay(); // 0 = Sun
    const diff = (day + 6) % 7; // days since Monday
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  } else if (preset === "month") {
    // default already set
  } else {
    // custom range from explicit from/to (YYYY-MM-DD)
    const from = cleanString(searchParams.get("from"));
    const to = cleanString(searchParams.get("to"));
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) start = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        // include the whole 'to' day
        end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
    }
  }

  return { start, end };
}

export async function GET(req: NextRequest) {
  const { response } = await requirePermission([
    "dashboard.view",
    "outlets.view",
    "reports.profit",
  ]);
  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { start, end } = parseRange(searchParams);

  const outlets = await OutletModel.find({})
    .select("name code isActive status")
    .sort({ name: 1 })
    .lean();

  // Aggregate mobile sales by outlet tag within the date range.
  // Sales remarks look like: "MOBILE SALE OUTLET:<id> SHIFT:<id>"
  const salesByOutlet = await (SaleModel as any).aggregate([
    {
      $match: {
        saleDate: { $gte: start, $lt: end },
        isVoided: { $ne: true },
        remarks: { $regex: "MOBILE SALE OUTLET:" },
      },
    },
    {
      $project: {
        totalAmount: 1,
        // extract the 24-hex id after "OUTLET:"
        outletId: {
          $arrayElemAt: [
            {
              $regexFindAll: { input: "$remarks", regex: "OUTLET:([a-f0-9]{24})" },
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        totalAmount: 1,
        outletId: { $arrayElemAt: ["$outletId.captures", 0] },
      },
    },
    {
      $group: {
        _id: "$outletId",
        salesTotal: { $sum: "$totalAmount" },
        salesCount: { $sum: 1 },
      },
    },
  ]);

  // Aggregate mobile expenses by outlet tag.
  const expensesByOutlet = await (ExpenseModel as any).aggregate([
    {
      $match: {
        isActive: true,
        expenseDate: { $gte: start, $lt: end },
        remarks: { $regex: "MOBILE EXPENSE OUTLET:" },
      },
    },
    {
      $project: {
        amount: 1,
        outletId: {
          $arrayElemAt: [
            {
              $regexFindAll: { input: "$remarks", regex: "OUTLET:([a-f0-9]{24})" },
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        amount: 1,
        outletId: { $arrayElemAt: ["$outletId.captures", 0] },
      },
    },
    {
      $group: {
        _id: "$outletId",
        expenseTotal: { $sum: "$amount" },
        expenseCount: { $sum: 1 },
      },
    },
  ]);

  const salesMap = new Map<string, { salesTotal: number; salesCount: number }>();
  for (const s of salesByOutlet as any[]) {
    if (s._id) salesMap.set(String(s._id), {
      salesTotal: Number(s.salesTotal || 0),
      salesCount: Number(s.salesCount || 0),
    });
  }
  const expenseMap = new Map<string, { expenseTotal: number; expenseCount: number }>();
  for (const e of expensesByOutlet as any[]) {
    if (e._id) expenseMap.set(String(e._id), {
      expenseTotal: Number(e.expenseTotal || 0),
      expenseCount: Number(e.expenseCount || 0),
    });
  }

  const rows = (outlets as any[]).map((o) => {
    const id = o._id.toString();
    const sales = salesMap.get(id) || { salesTotal: 0, salesCount: 0 };
    const exp = expenseMap.get(id) || { expenseTotal: 0, expenseCount: 0 };
    return {
      outletId: id,
      name: o.name || "",
      code: o.code || "",
      isActive: o.isActive !== false,
      salesTotal: sales.salesTotal,
      salesCount: sales.salesCount,
      expenseTotal: exp.expenseTotal,
      expenseCount: exp.expenseCount,
      net: sales.salesTotal - exp.expenseTotal,
    };
  });

  // Sort by sales desc so the best performers are on top.
  rows.sort((a, b) => b.salesTotal - a.salesTotal);

  const totals = rows.reduce(
    (acc, r) => {
      acc.salesTotal += r.salesTotal;
      acc.expenseTotal += r.expenseTotal;
      acc.net += r.net;
      acc.salesCount += r.salesCount;
      return acc;
    },
    { salesTotal: 0, expenseTotal: 0, net: 0, salesCount: 0 }
  );

  return NextResponse.json({
    success: true,
    range: { start: start.toISOString(), end: end.toISOString() },
    rows,
    totals,
  });
}

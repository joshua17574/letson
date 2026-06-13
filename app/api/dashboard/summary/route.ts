// app/api/dashboard/summary/route.ts
import { NextResponse } from "next/server";

import { getDashboardSummary } from "@/lib/dashboard";
import { requirePermission } from "@/lib/require-permission";

export async function GET() {
  const { response } = await requirePermission("dashboard.view");

  if (response) {
    return response;
  }

  const summary = await getDashboardSummary();

  return NextResponse.json({
    success: true,
    data: summary,
  });
}
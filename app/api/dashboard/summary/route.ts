// app/api/dashboard/summary/route.ts
import { NextResponse } from "next/server";

import { getDashboardSummary } from "@/lib/dashboard";
import { requireApiAuth } from "@/lib/require-auth";

export async function GET() {
  const { response } = await requireApiAuth();

  if (response) {
    return response;
  }

  const summary = await getDashboardSummary();

  return NextResponse.json({
    success: true,
    data: summary,
  });
}
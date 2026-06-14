// app/api/mobile/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user, response } = await requireMobileAuth(req);
  if (response) return response;

  return NextResponse.json({ success: true, user });
}

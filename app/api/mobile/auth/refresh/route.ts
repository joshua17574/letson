// app/api/mobile/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireMobileAuth, signMobileToken } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

// Exchanges a still-valid token for a fresh one, so an active cashier never
// gets logged out mid-shift. (If the token has already expired, the app must
// log in again.)
export async function POST(req: NextRequest) {
  const { user, response } = await requireMobileAuth(req);
  if (response) return response;

  const token = signMobileToken(user.id, user.username);

  return NextResponse.json({ success: true, token, user });
}

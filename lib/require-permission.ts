// lib/require-permission.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export async function requirePermission(permission: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      ),
    };
  }

  const permissions = ((session.user as any).permissions || []) as string[];

  if (!permissions.includes(permission)) {
    return {
      session,
      response: NextResponse.json(
        {
          success: false,
          message: "Forbidden. You do not have permission.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    session,
    response: null,
  };
}
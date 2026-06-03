import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import type { RolePermission } from "@/lib/role-permissions";

export async function requirePermission(permission: RolePermission) {
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

  const user = session.user;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  // Admin is still checked through role permissions during normal use, but this
  // prevents accidental lockout while fixing old seeded users/sessions.
  if (user.role === "ADMIN" || permissions.includes(permission)) {
    return { session, response: null };
  }

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

// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString } from "@/lib/crud-utils";
import RoleModel from "@/models/Role";
import UserModel from "@/models/User";

type UserRole = "ADMIN" | "MANAGER" | "CASHIER" | "STAFF" | "USER";

const allowedRoles: UserRole[] = [
  "ADMIN",
  "MANAGER",
  "CASHIER",
  "STAFF",
  "USER",
];

function isUserRole(value: string): value is UserRole {
  return allowedRoles.includes(value as UserRole);
}

function serializeUser(user: any) {
  const role = user.roleId;

  return {
    _id: user._id.toString(),
    name: user.name || "",
    email: user.email || "",
    role: user.role || "USER",

    roleId: role?._id?.toString?.() || user.roleId?.toString?.() || "",
    roleName: role?.name || "",
    permissions: role?.permissions || [],
    permissionCount: Number(role?.permissions?.length || 0),

    isActive: Boolean(user.isActive),

    createdAt: user.createdAt
      ? new Date(user.createdAt).toISOString()
      : undefined,

    updatedAt: user.updatedAt
      ? new Date(user.updatedAt).toISOString()
      : undefined,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid user ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const user = await UserModel.findOne({
    _id: id,
    isActive: true,
  })
    .populate("roleId", "name permissions")
    .lean();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        message: "User not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: serializeUser(user),
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid user ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const user = await UserModel.findOne({
    _id: id,
    isActive: true,
  });

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        message: "User not found.",
      },
      { status: 404 }
    );
  }

  const body = await req.json();

  const name = cleanString(body.name).toUpperCase();
  const email = cleanString(body.email).toLowerCase();
  const password = cleanString(body.password);
  const roleInput = cleanString(body.role).toUpperCase();
  const roleId = cleanString(body.roleId);

  if (!name) {
    return NextResponse.json(
      {
        success: false,
        message: "User name is required.",
      },
      { status: 400 }
    );
  }

  if (!email) {
    return NextResponse.json(
      {
        success: false,
        message: "Email is required.",
      },
      { status: 400 }
    );
  }

  if (!roleId || !isValidObjectId(roleId)) {
    return NextResponse.json(
      {
        success: false,
        message: "Valid role is required.",
      },
      { status: 400 }
    );
  }

  const roleRecord = await RoleModel.findOne({
    _id: roleId,
    isActive: true,
  });

  if (!roleRecord) {
    return NextResponse.json(
      {
        success: false,
        message: "Selected role was not found.",
      },
      { status: 404 }
    );
  }

  const duplicate = await UserModel.findOne({
    _id: {
      $ne: id,
    },
    email,
    isActive: true,
  });

  if (duplicate) {
    return NextResponse.json(
      {
        success: false,
        message: "Email already exists.",
      },
      { status: 409 }
    );
  }

  user.name = name;
  user.email = email;
  user.role = isUserRole(roleInput) ? roleInput : user.role || "USER";
  user.roleId = roleId as any;

  if (password) {
    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be at least 6 characters.",
        },
        { status: 400 }
      );
    }

    user.password = await bcrypt.hash(password, 12);
  }

  await user.save();

  const populatedUser = await UserModel.findById(user._id)
    .populate("roleId", "name permissions")
    .lean();

  return NextResponse.json({
    success: true,
    message: "User updated successfully.",
    data: serializeUser(populatedUser),
  });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid user ID.",
      },
      { status: 400 }
    );
  }

  if (session?.user?.id === id) {
    return NextResponse.json(
      {
        success: false,
        message: "You cannot disable your own account.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const user = await UserModel.findOne({
    _id: id,
    isActive: true,
  });

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        message: "User not found.",
      },
      { status: 404 }
    );
  }

  user.isActive = false;
  await user.save();

  return NextResponse.json({
    success: true,
    message: "User disabled successfully.",
  });
}
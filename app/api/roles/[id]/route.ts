// app/api/roles/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString } from "@/lib/crud-utils";
import { isValidRolePermission } from "@/lib/role-permissions";
import RoleModel from "@/models/Role";

function serializeRole(role: any) {
  return {
    _id: role._id.toString(),
    name: role.name,
    description: role.description || "",
    permissions: role.permissions || [],
    permissionCount: Number(role.permissions?.length || 0),
    isSystem: Boolean(role.isSystem),
    isActive: Boolean(role.isActive),
    createdAt: role.createdAt
      ? new Date(role.createdAt).toISOString()
      : undefined,
    updatedAt: role.updatedAt
      ? new Date(role.updatedAt).toISOString()
      : undefined,
  };
}

function cleanPermissions(input: unknown) {
  if (!Array.isArray(input)) return [];

  return Array.from(
    new Set(
      input
        .map((item) => cleanString(item))
        .filter((item) => item && isValidRolePermission(item))
    )
  );
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
        message: "Invalid role ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const role = await RoleModel.findOne({
    _id: id,
    isActive: true,
  }).lean();

  if (!role) {
    return NextResponse.json(
      {
        success: false,
        message: "Role not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: serializeRole(role),
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
        message: "Invalid role ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const role = await RoleModel.findOne({
    _id: id,
    isActive: true,
  });

  if (!role) {
    return NextResponse.json(
      {
        success: false,
        message: "Role not found.",
      },
      { status: 404 }
    );
  }

  if (role.isSystem) {
    return NextResponse.json(
      {
        success: false,
        message: "System role cannot be edited.",
      },
      { status: 403 }
    );
  }

  const body = await req.json();

  const name = cleanString(body.name).toUpperCase();
  const description = cleanString(body.description);
  const permissions = cleanPermissions(body.permissions);

  if (!name) {
    return NextResponse.json(
      {
        success: false,
        message: "Role name is required.",
      },
      { status: 400 }
    );
  }

  const duplicate = await RoleModel.findOne({
    _id: {
      $ne: id,
    },
    name,
    isActive: true,
  });

  if (duplicate) {
    return NextResponse.json(
      {
        success: false,
        message: "Role name already exists.",
      },
      { status: 409 }
    );
  }

  role.name = name;
  role.description = description;
  role.permissions = permissions;

  await role.save();

  return NextResponse.json({
    success: true,
    message: "Role updated successfully.",
    data: serializeRole(role.toObject()),
  });
}

export async function DELETE(
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
        message: "Invalid role ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const role = await RoleModel.findOne({
    _id: id,
    isActive: true,
  });

  if (!role) {
    return NextResponse.json(
      {
        success: false,
        message: "Role not found.",
      },
      { status: 404 }
    );
  }

  if (role.isSystem) {
    return NextResponse.json(
      {
        success: false,
        message: "System role cannot be disabled.",
      },
      { status: 403 }
    );
  }

  role.isActive = false;
  await role.save();

  return NextResponse.json({
    success: true,
    message: "Role disabled successfully.",
  });
}
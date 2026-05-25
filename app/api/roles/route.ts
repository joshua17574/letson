// app/api/roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { QueryFilter } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import {
  cleanString,
  escapeRegex,
  getPagination,
} from "@/lib/crud-utils";
import { isValidRolePermission } from "@/lib/role-permissions";
import RoleModel, { IRole } from "@/models/Role";

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

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const search = cleanString(searchParams.get("search"));

  const filter: QueryFilter<IRole> = {
    isActive: true,
  };

  if (search) {
    filter.name = {
      $regex: escapeRegex(search),
      $options: "i",
    };
  }

  const [items, total] = await Promise.all([
    RoleModel.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    RoleModel.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: items.map(serializeRole),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}

export async function POST(req: NextRequest) {
  const { response, session } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

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

  const existing = await RoleModel.findOne({
    name,
    isActive: true,
  });

  if (existing) {
    return NextResponse.json(
      {
        success: false,
        message: "Role name already exists.",
      },
      { status: 409 }
    );
  }

  const role = await RoleModel.create({
    name,
    description,
    permissions,
    createdBy: session?.user?.id,
  });

  return NextResponse.json(
    {
      success: true,
      message: "Role created successfully.",
      data: serializeRole(role.toObject()),
    },
    { status: 201 }
  );
}
// app/api/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { QueryFilter } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { withAuditLog } from "@/lib/audit-log";
import { CATEGORY_LOOKUP_PERMISSIONS } from "@/lib/role-permissions";
import {
  cleanString,
  escapeRegex,
  getPagination,
  serializeDocuments,
  serializeDocument,
} from "@/lib/crud-utils";
import CategoryModel, { ICategory } from "@/models/Category";

export async function GET(req: NextRequest) {
  const { response } = await requirePermission(CATEGORY_LOOKUP_PERMISSIONS);

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const search = cleanString(searchParams.get("search"));

  const filter: QueryFilter<ICategory> = {
    isActive: true,
  };

  if (search) {
    filter.name = {
      $regex: escapeRegex(search),
      $options: "i",
    };
  }

  const [items, total] = await Promise.all([
    CategoryModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    CategoryModel.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: serializeDocuments(items),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}

async function handlePOST(req: NextRequest) {
  const { response } = await requirePermission("categories.manage");

  if (response) return response;

  await dbConnect();

  const body = await req.json();

  const name = cleanString(body.name);
  const description = cleanString(body.description);

  if (!name) {
    return NextResponse.json(
      {
        success: false,
        message: "Category name is required.",
      },
      { status: 400 }
    );
  }

  const category = await CategoryModel.create({
    name,
    description,
  });

  return NextResponse.json(
    {
      success: true,
      message: "Category created successfully.",
      data: serializeDocument(category.toObject()),
    },
    { status: 201 }
  );
}

export const POST = withAuditLog(handlePOST, {
  module: "CATEGORIES",
  action: "CREATE",
  entityType: "CATEGORY",
});

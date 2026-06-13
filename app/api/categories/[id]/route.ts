// app/api/categories/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { withAuditLog } from "@/lib/audit-log";
import { cleanString, serializeDocument } from "@/lib/crud-utils";
import CategoryModel from "@/models/Category";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission(["categories.view", "categories.manage"]);

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid category ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const category = await CategoryModel.findOne({
    _id: id,
    isActive: true,
  }).lean();

  if (!category) {
    return NextResponse.json(
      {
        success: false,
        message: "Category not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: serializeDocument(category),
  });
}

async function handlePATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission("categories.manage");

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid category ID.",
      },
      { status: 400 }
    );
  }

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

  const updatedCategory = await CategoryModel.findOneAndUpdate(
    {
      _id: id,
      isActive: true,
    },
    {
      name,
      description,
    },
    {
      new: true,
    }
  ).lean();

  if (!updatedCategory) {
    return NextResponse.json(
      {
        success: false,
        message: "Category not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Category updated successfully.",
    data: serializeDocument(updatedCategory),
  });
}

async function handleDELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission("categories.manage");

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid category ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const deletedCategory = await CategoryModel.findOneAndUpdate(
    {
      _id: id,
      isActive: true,
    },
    {
      isActive: false,
    },
    {
      new: true,
    }
  ).lean();

  if (!deletedCategory) {
    return NextResponse.json(
      {
        success: false,
        message: "Category not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Category deleted successfully.",
  });
}

export const PATCH = withAuditLog(handlePATCH, {
  module: "CATEGORIES",
  action: "UPDATE",
  entityType: "CATEGORY",
});

export const DELETE = withAuditLog(handleDELETE, {
  module: "CATEGORIES",
  action: "DELETE",
  entityType: "CATEGORY",
});

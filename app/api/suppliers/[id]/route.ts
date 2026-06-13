// app/api/suppliers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { withAuditLog } from "@/lib/audit-log";
import { cleanString, serializeDocument } from "@/lib/crud-utils";
import SupplierModel from "@/models/Supplier";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission(["suppliers.view", "suppliers.manage"]);

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid supplier ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const supplier = await SupplierModel.findOne({
    _id: id,
    isActive: true,
  }).lean();

  if (!supplier) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: serializeDocument(supplier),
  });
}

async function handlePATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission("suppliers.manage");

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid supplier ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const body = await req.json();

  const name = cleanString(body.name);
  const email = cleanString(body.email);
  const phone = cleanString(body.phone);
  const address = cleanString(body.address);

  if (!name) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier name is required.",
      },
      { status: 400 }
    );
  }

  const updatedSupplier = await SupplierModel.findOneAndUpdate(
    {
      _id: id,
      isActive: true,
    },
    {
      name,
      email,
      phone,
      address,
    },
    {
      new: true,
    }
  ).lean();

  if (!updatedSupplier) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Supplier updated successfully.",
    data: serializeDocument(updatedSupplier),
  });
}

async function handleDELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission("suppliers.manage");

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid supplier ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const deletedSupplier = await SupplierModel.findOneAndUpdate(
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

  if (!deletedSupplier) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Supplier deleted successfully.",
  });
}

export const PATCH = withAuditLog(handlePATCH, {
  module: "SUPPLIERS",
  action: "UPDATE",
  entityType: "SUPPLIER",
});

export const DELETE = withAuditLog(handleDELETE, {
  module: "SUPPLIERS",
  action: "DELETE",
  entityType: "SUPPLIER",
});

// app/api/suppliers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString, serializeDocument } from "@/lib/crud-utils";
import SupplierModel from "@/models/Supplier";

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
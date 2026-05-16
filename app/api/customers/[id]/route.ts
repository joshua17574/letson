// app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString, serializeDocument } from "@/lib/crud-utils";
import CustomerModel, { CustomerType } from "@/models/Customer";

const customerTypes: CustomerType[] = ["SALE", "DELIVERY", "BOTH"];

function isCustomerType(value: string): value is CustomerType {
  return customerTypes.includes(value as CustomerType);
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
        message: "Invalid customer ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const customer = await CustomerModel.findOne({
    _id: id,
    isActive: true,
  }).lean();

  if (!customer) {
    return NextResponse.json(
      {
        success: false,
        message: "Customer not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: serializeDocument(customer),
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
        message: "Invalid customer ID.",
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
  const typeInput = cleanString(body.type).toUpperCase();

  if (!name) {
    return NextResponse.json(
      {
        success: false,
        message: "Customer name is required.",
      },
      { status: 400 }
    );
  }

  const updatedCustomer = await CustomerModel.findOneAndUpdate(
    {
      _id: id,
      isActive: true,
    },
    {
      name,
      email,
      phone,
      address,
      type: isCustomerType(typeInput) ? typeInput : "SALE",
    },
    {
      new: true,
    }
  ).lean();

  if (!updatedCustomer) {
    return NextResponse.json(
      {
        success: false,
        message: "Customer not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Customer updated successfully.",
    data: serializeDocument(updatedCustomer),
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
        message: "Invalid customer ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const deletedCustomer = await CustomerModel.findOneAndUpdate(
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

  if (!deletedCustomer) {
    return NextResponse.json(
      {
        success: false,
        message: "Customer not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Customer deleted successfully.",
  });
}
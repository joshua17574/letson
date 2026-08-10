// app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { withAuditLog } from "@/lib/audit-log";
import { cleanString, serializeDocument } from "@/lib/crud-utils";
import { isOutletManagedCustomer } from "@/lib/outlet-payment-customer-policy";
import CustomerModel, { CustomerType } from "@/models/Customer";

const customerTypes: CustomerType[] = ["SALE", "DELIVERY", "BOTH"];

function isCustomerType(value: string): value is CustomerType {
  return customerTypes.includes(value as CustomerType);
}

function editableCustomerFilter(id: string) {
  return {
    _id: id,
    isActive: true,
    $or: [{ outletId: { $exists: false } }, { outletId: null }],
  };
}

async function customerMutationFailure(id: string) {
  const customer = await CustomerModel.findById(id)
    .select("outletId isActive")
    .lean();

  if (customer && isOutletManagedCustomer(customer)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Outlet payment accounts are managed by the outlet and cannot be changed here.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      success: false,
      message: "Customer not found.",
    },
    { status: 404 },
  );
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requirePermission([
    "customers.view",
    "customers.manage",
  ]);

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid customer ID.",
      },
      { status: 400 },
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
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    data: serializeDocument(customer),
  });
}

async function handlePATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requirePermission("customers.manage");

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid customer ID.",
      },
      { status: 400 },
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
      { status: 400 },
    );
  }

  const updatedCustomer = await CustomerModel.findOneAndUpdate(
    editableCustomerFilter(id),
    {
      name,
      email,
      phone,
      address,
      type: isCustomerType(typeInput) ? typeInput : "SALE",
    },
    {
      new: true,
    },
  ).lean();

  if (!updatedCustomer) {
    return customerMutationFailure(id);
  }

  return NextResponse.json({
    success: true,
    message: "Customer updated successfully.",
    data: serializeDocument(updatedCustomer),
  });
}

async function handleDELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requirePermission("customers.manage");

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid customer ID.",
      },
      { status: 400 },
    );
  }

  await dbConnect();

  const deletedCustomer = await CustomerModel.findOneAndUpdate(
    editableCustomerFilter(id),
    {
      isActive: false,
    },
    {
      new: true,
    },
  ).lean();

  if (!deletedCustomer) {
    return customerMutationFailure(id);
  }

  return NextResponse.json({
    success: true,
    message: "Customer deleted successfully.",
  });
}

export const PATCH = withAuditLog(handlePATCH, {
  module: "CUSTOMERS",
  action: "UPDATE",
  entityType: "CUSTOMER",
});

export const DELETE = withAuditLog(handleDELETE, {
  module: "CUSTOMERS",
  action: "DELETE",
  entityType: "CUSTOMER",
});

import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { cleanDeliveryCategory, serializeCustomerDelivery, serializeCustomerDeliveryItem } from "@/lib/customer-delivery-utils";
import { cleanString } from "@/lib/crud-utils";
import CustomerDeliveryModel from "@/models/CustomerDelivery";
import CustomerDeliveryItemModel from "@/models/CustomerDeliveryItem";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission("customer-deliveries.view");
  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid customer delivery ID." },
      { status: 400 }
    );
  }

  await dbConnect();

  const delivery = await CustomerDeliveryModel.findOne({ _id: id, isActive: true })
    .populate("customerId", "name phone address type")
    .lean();

  if (!delivery) {
    return NextResponse.json(
      { success: false, message: "Customer delivery not found." },
      { status: 404 }
    );
  }

  const items = await CustomerDeliveryItemModel.find({ customerDeliveryId: id })
    .sort({ createdAt: 1 })
    .lean();

  return NextResponse.json({
    success: true,
    data: {
      ...serializeCustomerDelivery(delivery),
      items: items.map(serializeCustomerDeliveryItem),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission("customer-deliveries.manage");
  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid customer delivery ID." },
      { status: 400 }
    );
  }

  await dbConnect();

  const existing = await CustomerDeliveryModel.findOne({ _id: id, isActive: true });

  if (!existing) {
    return NextResponse.json(
      { success: false, message: "Customer delivery not found." },
      { status: 404 }
    );
  }

  if (existing.status !== "PENDING") {
    return NextResponse.json(
      { success: false, message: "Only pending customer deliveries can be edited." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const category = cleanDeliveryCategory(body.category);
  const scheduledDateInput = cleanString(body.scheduledDate);
  const remarks = cleanString(body.remarks);

  const updated = await CustomerDeliveryModel.findOneAndUpdate(
    { _id: id, isActive: true, status: "PENDING" },
    {
      category,
      scheduledDate: scheduledDateInput ? new Date(scheduledDateInput) : undefined,
      remarks,
    },
    { new: true }
  )
    .populate("customerId", "name phone address type")
    .lean();

  return NextResponse.json({
    success: true,
    message: "Customer delivery updated successfully.",
    data: serializeCustomerDelivery(updated),
  });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requirePermission("customer-deliveries.manage");
  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid customer delivery ID." },
      { status: 400 }
    );
  }

  await dbConnect();

  const cancelled = await CustomerDeliveryModel.findOneAndUpdate(
    { _id: id, isActive: true, status: "PENDING" },
    {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: session?.user?.id,
    },
    { new: true }
  );

  if (!cancelled) {
    return NextResponse.json(
      { success: false, message: "Only pending customer deliveries can be cancelled." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Customer delivery cancelled successfully.",
  });
}

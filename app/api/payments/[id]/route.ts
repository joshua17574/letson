// app/api/payments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import PaymentModel from "@/models/Payment";
import PaymentAllocationModel from "@/models/PaymentAllocation";
import SaleModel from "@/models/Sale";

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
        message: "Invalid payment ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const payment = await PaymentModel.findOne({
    _id: id,
    isVoided: false,
  });

  if (!payment) {
    return NextResponse.json(
      {
        success: false,
        message: "Payment not found.",
      },
      { status: 404 }
    );
  }

  const allocations = await PaymentAllocationModel.find({
    paymentId: payment._id,
  });

  for (const allocation of allocations) {
    const sale = await SaleModel.findById(allocation.saleId);

    if (!sale || sale.isVoided) continue;

    sale.paidAmount = Math.max(
      Number(sale.paidAmount || 0) - Number(allocation.amount || 0),
      0
    );

    sale.balance = Math.max(Number(sale.totalAmount || 0) - sale.paidAmount, 0);

    if (sale.balance <= 0) {
      sale.status = "PAID";
    } else if (sale.paidAmount > 0) {
      sale.status = "PARTIAL";
    } else {
      sale.status = "UNPAID";
    }

    await sale.save();
  }

  payment.isVoided = true;
  await payment.save();

  return NextResponse.json({
    success: true,
    message: "Payment voided successfully.",
  });
}
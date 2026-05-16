// app/api/payments/customer/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString } from "@/lib/crud-utils";
import CustomerModel from "@/models/Customer";
import PaymentModel from "@/models/Payment";
import SaleModel from "@/models/Sale";

function formatSale(sale: any) {
  return {
    _id: sale._id.toString(),
    saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString() : undefined,
    receiptNumber: sale.receiptNumber,
    totalAmount: sale.totalAmount || 0,
    paidAmount: sale.paidAmount || 0,
    balance: sale.balance || 0,
    totalPacks: sale.totalPacks || 0,
    remarks: sale.remarks || "",
    status: sale.status,
  };
}

function formatPayment(payment: any) {
  return {
    _id: payment._id.toString(),
    paymentDate: payment.paymentDate
      ? new Date(payment.paymentDate).toISOString()
      : undefined,
    amount: payment.amount || 0,
    appliedAmount: payment.appliedAmount || 0,
    unappliedAmount: payment.unappliedAmount || 0,
    referenceNumber: payment.referenceNumber || "",
    receiptImageUrl: payment.receiptImageUrl || "",
    remarks: payment.remarks || "",
  };
}

export async function GET(
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

  const { searchParams } = new URL(req.url);

  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

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

  const baseSaleFilter: any = {
    customerId: id,
    isVoided: false,
  };

  const basePaymentFilter: any = {
    customerId: id,
    isVoided: false,
  };

  const filteredSaleFilter: any = {
    ...baseSaleFilter,
  };

  const filteredPaymentFilter: any = {
    ...basePaymentFilter,
  };

  if (dateFrom || dateTo) {
    filteredSaleFilter.saleDate = {};
    filteredPaymentFilter.paymentDate = {};

    if (dateFrom) {
      filteredSaleFilter.saleDate.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
      filteredPaymentFilter.paymentDate.$gte = new Date(
        `${dateFrom}T00:00:00.000Z`
      );
    }

    if (dateTo) {
      filteredSaleFilter.saleDate.$lte = new Date(`${dateTo}T23:59:59.999Z`);
      filteredPaymentFilter.paymentDate.$lte = new Date(
        `${dateTo}T23:59:59.999Z`
      );
    }
  }

  const [
    overallSales,
    overallPayments,
    filteredSales,
    filteredPayments,
    recentSales,
    recentPayments,
  ] = await Promise.all([
    SaleModel.aggregate([
      {
        $match: baseSaleFilter,
      },
      {
        $group: {
          _id: null,
          totalSales: {
            $sum: "$totalAmount",
          },
          totalPacks: {
            $sum: "$totalPacks",
          },
        },
      },
    ]),

    PaymentModel.aggregate([
      {
        $match: basePaymentFilter,
      },
      {
        $group: {
          _id: null,
          totalPaid: {
            $sum: "$amount",
          },
        },
      },
    ]),

    SaleModel.aggregate([
      {
        $match: filteredSaleFilter,
      },
      {
        $group: {
          _id: null,
          totalSales: {
            $sum: "$totalAmount",
          },
          totalPacks: {
            $sum: "$totalPacks",
          },
        },
      },
    ]),

    PaymentModel.aggregate([
      {
        $match: filteredPaymentFilter,
      },
      {
        $group: {
          _id: null,
          totalPaid: {
            $sum: "$amount",
          },
        },
      },
    ]),

    SaleModel.find(filteredSaleFilter)
      .sort({ saleDate: -1, createdAt: -1 })
      .limit(10)
      .lean(),

    PaymentModel.find(filteredPaymentFilter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const os = overallSales[0] || {
    totalSales: 0,
    totalPacks: 0,
  };

  const op = overallPayments[0] || {
    totalPaid: 0,
  };

  const fs = filteredSales[0] || {
    totalSales: 0,
    totalPacks: 0,
  };

  const fp = filteredPayments[0] || {
    totalPaid: 0,
  };

  return NextResponse.json({
    success: true,
    customer: {
      _id: customer._id.toString(),
      name: customer.name,
    },
    overall: {
      totalSales: os.totalSales || 0,
      totalPaid: op.totalPaid || 0,
      balance: (os.totalSales || 0) - (op.totalPaid || 0),
      totalPacks: os.totalPacks || 0,
    },
    filtered: {
      totalSales: fs.totalSales || 0,
      totalPaid: fp.totalPaid || 0,
      balance: (fs.totalSales || 0) - (fp.totalPaid || 0),
      totalPacks: fs.totalPacks || 0,
    },
    recentSales: recentSales.map(formatSale),
    recentPayments: recentPayments.map(formatPayment),
  });
}
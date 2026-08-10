// app/api/payments/customer/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { cleanString } from "@/lib/crud-utils";
import { paymentPosition } from "@/lib/payment-summary";
import CustomerModel from "@/models/Customer";
import PaymentModel from "@/models/Payment";
import SaleModel from "@/models/Sale";

function notVoidedFilter() {
  return {
    $or: [{ isVoided: { $exists: false } }, { isVoided: false }],
  };
}

function getDateFilter(dateField: string, dateFrom: string, dateTo: string) {
  const filter: Record<string, any> = {};

  if (dateFrom || dateTo) {
    filter[dateField] = {};

    if (dateFrom) {
      filter[dateField].$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      filter[dateField].$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  return filter;
}

function getPaymentAmount(payment: any) {
  return Number(
    payment.amount ??
      payment.amountReceived ??
      payment.amountPaid ??
      payment.appliedAmount ??
      0,
  );
}

function getAppliedAmount(payment: any) {
  const amount = getPaymentAmount(payment);
  return Number(payment.appliedAmount ?? amount ?? 0);
}

function formatSale(sale: any) {
  return {
    _id: sale._id.toString(),
    saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString() : undefined,
    receiptNumber: sale.receiptNumber || "",
    totalAmount: Number(sale.totalAmount || 0),
    paidAmount: Number(sale.paidAmount || 0),
    balance: Number(sale.balance || 0),
    totalPacks: Number(sale.totalPacks || sale.totalQty || 0),
    remarks: sale.remarks || "",
    status: sale.status || "",
  };
}

function formatPayment(payment: any) {
  const amount = getPaymentAmount(payment);
  const appliedAmount = getAppliedAmount(payment);

  return {
    _id: payment._id.toString(),
    paymentDate: payment.paymentDate
      ? new Date(payment.paymentDate).toISOString()
      : undefined,
    amount,
    appliedAmount,
    unappliedAmount: Number(payment.unappliedAmount || 0),
    referenceNumber: payment.referenceNumber || "",
    receiptImageUrl: payment.receiptImageUrl || "",
    remarks: payment.remarks || "",
  };
}

function summarizeSales(sales: any[]) {
  return sales.reduce(
    (sum, sale) => ({
      totalSales: sum.totalSales + Number(sale.totalAmount || 0),
      immediateCashSales:
        sum.immediateCashSales +
        (/^MOB-/.test(String(sale.receiptNumber || ""))
          ? Number(sale.paidAmount || 0)
          : 0),
      totalPacks:
        sum.totalPacks + Number(sale.totalPacks || sale.totalQty || 0),
    }),
    {
      totalSales: 0,
      immediateCashSales: 0,
      totalPacks: 0,
    },
  );
}

function summarizePayments(payments: any[]) {
  return payments.reduce(
    (sum, payment) => ({
      recordedPayments: sum.recordedPayments + getPaymentAmount(payment),
    }),
    {
      recordedPayments: 0,
    },
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requirePermission([
    "payments.view",
    "payments.manage",
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

  const customerObjectId = new Types.ObjectId(id);

  const { searchParams } = new URL(req.url);
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

  const customer = await CustomerModel.findById(customerObjectId).lean();

  const customerMatch = {
    customerId: {
      $in: [customerObjectId, id],
    },
  };

  const overallSaleFilter = {
    ...customerMatch,
    ...notVoidedFilter(),
  };

  const overallPaymentFilter = {
    ...customerMatch,
    ...notVoidedFilter(),
  };

  const filteredSaleFilter = {
    ...overallSaleFilter,
    ...getDateFilter("saleDate", dateFrom, dateTo),
  };

  const filteredPaymentFilter = {
    ...overallPaymentFilter,
    ...getDateFilter("paymentDate", dateFrom, dateTo),
  };

  const [
    overallSalesRecords,
    overallPaymentsRecords,
    filteredSalesRecords,
    filteredPaymentsRecords,
    recentSales,
    recentPayments,
  ] = await Promise.all([
    SaleModel.find(overallSaleFilter).lean(),
    PaymentModel.find(overallPaymentFilter).lean(),

    SaleModel.find(filteredSaleFilter).lean(),
    PaymentModel.find(filteredPaymentFilter).lean(),

    SaleModel.find(filteredSaleFilter)
      .sort({ saleDate: -1, createdAt: -1 })
      .limit(10)
      .lean(),

    PaymentModel.find(filteredPaymentFilter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  if (
    !customer &&
    overallSalesRecords.length === 0 &&
    overallPaymentsRecords.length === 0
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Customer not found.",
      },
      { status: 404 },
    );
  }

  const overallSales = summarizeSales(overallSalesRecords);
  const overallPayments = summarizePayments(overallPaymentsRecords);
  const overallPosition = paymentPosition({
    sales: overallSales.totalSales,
    immediateCashSales: overallSales.immediateCashSales,
    recordedPayments: overallPayments.recordedPayments,
  });

  const filteredSales = summarizeSales(filteredSalesRecords);
  const filteredPayments = summarizePayments(filteredPaymentsRecords);
  const filteredPosition = paymentPosition({
    sales: filteredSales.totalSales,
    immediateCashSales: filteredSales.immediateCashSales,
    recordedPayments: filteredPayments.recordedPayments,
  });

  return NextResponse.json({
    success: true,

    customer: {
      _id: customerObjectId.toString(),
      name: customer?.name || "Selected Customer",
    },

    overall: {
      totalSales: overallPosition.sales,
      totalPaid: overallPosition.paid,
      balance: overallPosition.balance,
      totalPacks: overallSales.totalPacks,
    },

    filtered: {
      totalSales: filteredPosition.sales,
      totalPaid: filteredPosition.paid,
      balance: filteredPosition.balance,
      totalPacks: filteredSales.totalPacks,
    },

    recentSales: recentSales.map(formatSale),
    recentPayments: recentPayments.map(formatPayment),
  });
}

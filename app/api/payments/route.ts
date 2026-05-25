// app/api/payments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { QueryFilter, isValidObjectId } from "mongoose";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import {
  cleanNumber,
  cleanString,
  escapeRegex,
  getPagination,
} from "@/lib/crud-utils";
import CustomerModel from "@/models/Customer";
import PaymentModel, { IPayment } from "@/models/Payment";
import PaymentAllocationModel from "@/models/PaymentAllocation";
import SaleModel from "@/models/Sale";
import { requirePermission } from "@/lib/require-permission";

export const runtime = "nodejs";

function serializePayment(payment: any) {
  return {
    _id: payment._id.toString(),
    customerId:
      payment.customerId?._id?.toString?.() || payment.customerId?.toString?.(),
    customerName: payment.customerId?.name || "",
    paymentDate: payment.paymentDate
      ? new Date(payment.paymentDate).toISOString()
      : undefined,
    amount: payment.amount || 0,
    appliedAmount: payment.appliedAmount || 0,
    unappliedAmount: payment.unappliedAmount || 0,
    referenceNumber: payment.referenceNumber || "",
    receiptImageUrl: payment.receiptImageUrl || "",
    remarks: payment.remarks || "",
    createdByName: payment.createdBy?.name || payment.createdBy?.username || "",
  };
}

async function saveReceiptImage(file: File) {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Receipt image must be JPG, JPEG, PNG, GIF, or WEBP.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Receipt image must not exceed 5MB.");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const extension = file.name.split(".").pop() || "jpg";
  const filename = `${crypto.randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "payments");

  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, filename);

  await writeFile(filePath, buffer);

  return `/uploads/payments/${filename}`;
}

export async function GET(req: NextRequest) {

    const { response } = await requirePermission("payments.view");

  if (response) return response;
  // const { response } = await requireApiAuth();

  // if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const customerId = cleanString(searchParams.get("customerId"));
  const search = cleanString(searchParams.get("search"));
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

  const filter: QueryFilter<IPayment> = {
    isVoided: false,
  };

  if (customerId && customerId !== "ALL" && isValidObjectId(customerId)) {
    filter.customerId = customerId;
  }

  if (dateFrom || dateTo) {
    filter.paymentDate = {};

    if (dateFrom) {
      filter.paymentDate.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      filter.paymentDate.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  if (search) {
    const customers = await CustomerModel.find({
      isActive: true,
      name: {
        $regex: escapeRegex(search),
        $options: "i",
      },
    })
      .select("_id")
      .lean();

    filter.customerId = {
      $in: customers.map((item) => item._id),
    };
  }

  const [items, total] = await Promise.all([
    PaymentModel.find(filter)
      .populate("customerId", "name")
      .populate("createdBy", "name username")
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    PaymentModel.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: items.map(serializePayment),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}

export async function POST(req: NextRequest) {
  const { response, session } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const formData = await req.formData();

  const customerId = cleanString(String(formData.get("customerId") || ""));
  const paymentDate = cleanString(String(formData.get("paymentDate") || ""));
  const amount = cleanNumber(String(formData.get("amount") || "0"));
  const referenceNumber = cleanString(String(formData.get("referenceNumber") || ""));
  const remarks = cleanString(String(formData.get("remarks") || ""));

  if (!customerId || !isValidObjectId(customerId)) {
    return NextResponse.json(
      {
        success: false,
        message: "Valid customer is required.",
      },
      { status: 400 }
    );
  }

  if (!paymentDate) {
    return NextResponse.json(
      {
        success: false,
        message: "Payment date is required.",
      },
      { status: 400 }
    );
  }

  if (amount <= 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Payment amount must be greater than zero.",
      },
      { status: 400 }
    );
  }

  const customer = await CustomerModel.findOne({
    _id: customerId,
    isActive: true,
  });

  if (!customer) {
    return NextResponse.json(
      {
        success: false,
        message: "Customer not found.",
      },
      { status: 404 }
    );
  }

  let receiptImageUrl = "";

  const receiptImage = formData.get("receiptImage");

  if (receiptImage instanceof File && receiptImage.size > 0) {
    try {
      receiptImageUrl = await saveReceiptImage(receiptImage);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Invalid receipt image.",
        },
        { status: 400 }
      );
    }
  }

  const payment = await PaymentModel.create({
    customerId,
    paymentDate: new Date(paymentDate),
    amount,
    appliedAmount: 0,
    unappliedAmount: amount,
    referenceNumber,
    receiptImageUrl,
    remarks,
    createdBy: session?.user?.id,
  });

  let remainingAmount = amount;
  let appliedAmount = 0;

  const unpaidSales = await SaleModel.find({
    customerId,
    isVoided: false,
    balance: {
      $gt: 0,
    },
  }).sort({ saleDate: 1, createdAt: 1 });

  const allocations = [];

  for (const sale of unpaidSales) {
    if (remainingAmount <= 0) break;

    const saleBalance = Number(sale.balance || 0);
    const amountToApply = Math.min(remainingAmount, saleBalance);

    sale.paidAmount = Number(sale.paidAmount || 0) + amountToApply;
    sale.balance = Math.max(Number(sale.totalAmount || 0) - sale.paidAmount, 0);

    if (sale.balance <= 0) {
      sale.status = "PAID";
    } else if (sale.paidAmount > 0) {
      sale.status = "PARTIAL";
    } else {
      sale.status = "UNPAID";
    }

    await sale.save();

    allocations.push({
      paymentId: payment._id,
      saleId: sale._id,
      amount: amountToApply,
    });

    remainingAmount -= amountToApply;
    appliedAmount += amountToApply;
  }

  if (allocations.length > 0) {
    await PaymentAllocationModel.insertMany(allocations);
  }

  payment.appliedAmount = appliedAmount;
  payment.unappliedAmount = Math.max(remainingAmount, 0);

  await payment.save();

  const populated = await PaymentModel.findById(payment._id)
    .populate("customerId", "name")
    .populate("createdBy", "name username")
    .lean();

  return NextResponse.json(
    {
      success: true,
      message: "Payment saved successfully.",
      data: serializePayment(populated),
    },
    { status: 201 }
  );
}
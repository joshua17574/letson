// app/api/sales/lines/route.ts
import { NextRequest, NextResponse } from "next/server";
import { QueryFilter } from "mongoose";

import dbConnect from "@/lib/mongodb";
import {
  cleanString,
  escapeRegex,
  getPagination,
} from "@/lib/crud-utils";
import { requireApiAuth } from "@/lib/require-auth";
import CustomerModel from "@/models/Customer";
import SaleModel from "@/models/Sale";
import SaleLineModel, { ISaleLine } from "@/models/SaleLine";

function serializeLine(line: any) {
  const sale = line.saleId;

  return {
    _id: line._id.toString(),
    saleId: sale?._id?.toString?.() || line.saleId?.toString?.() || "",
    receiptNumber: sale?.receiptNumber || "",
    saleDate: sale?.saleDate
      ? new Date(sale.saleDate).toISOString()
      : undefined,
    customerName: sale?.customerId?.name || "",
    source: line.source || sale?.source || "",
    categoryName: line.categoryName || "",
    productName: line.productName || "",
    qty: Number(line.qty || 0),
    price: Number(line.price || 0),
    lineTotal: Number(line.lineTotal || 0),
    remarks: line.remarks || "",
  };
}

function splitValues(value: string) {
  return value
    .split(",")
    .map((item) => cleanString(item))
    .filter(Boolean);
}

function makeExactRegexList(values: string[]) {
  return values.map((value) => new RegExp(`^${escapeRegex(value)}$`, "i"));
}

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));
  const receiptNumber = cleanString(searchParams.get("receiptNumber"));
  const customer = cleanString(searchParams.get("customer"));
  const source = cleanString(searchParams.get("source")).toUpperCase();
  const categoryNames = splitValues(cleanString(searchParams.get("categoryNames")));
  const productNames = splitValues(cleanString(searchParams.get("productNames")));

  const saleFilter: Record<string, any> = {
    isVoided: false,
  };

  if (dateFrom || dateTo) {
    saleFilter.saleDate = {};

    if (dateFrom) {
      saleFilter.saleDate.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      saleFilter.saleDate.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  if (receiptNumber) {
    saleFilter.receiptNumber = {
      $regex: escapeRegex(receiptNumber),
      $options: "i",
    };
  }

  if (customer) {
    const customers = await CustomerModel.find({
      isActive: true,
      name: {
        $regex: escapeRegex(customer),
        $options: "i",
      },
    })
      .select("_id")
      .lean();

    saleFilter.customerId = {
      $in: customers.map((item) => item._id),
    };
  }

  const saleIds = await SaleModel.find(saleFilter).select("_id").lean();

  if (saleIds.length === 0) {
    return NextResponse.json({
      success: true,
      data: [],
      summary: {
        rows: 0,
        totalAmount: 0,
      },
      meta: {
        page,
        limit,
        total: 0,
        totalPages: 1,
      },
    });
  }

  const lineFilter: QueryFilter<ISaleLine> = {
    saleId: {
      $in: saleIds.map((item) => item._id),
    },
  };

  if (source === "CHICKEN" || source === "BODEGA") {
    lineFilter.source = source;
  }

  if (categoryNames.length > 0) {
    lineFilter.categoryName = {
      $in: makeExactRegexList(categoryNames),
    } as any;
  }

  if (productNames.length > 0) {
    lineFilter.productName = {
      $in: makeExactRegexList(productNames),
    } as any;
  }

  const [items, total, summary] = await Promise.all([
    SaleLineModel.find(lineFilter)
      .populate({
        path: "saleId",
        select: "receiptNumber saleDate customerId source remarks",
        populate: {
          path: "customerId",
          select: "name",
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    SaleLineModel.countDocuments(lineFilter),

    SaleLineModel.aggregate([
      {
        $match: lineFilter,
      },
      {
        $group: {
          _id: null,
          rows: {
            $sum: 1,
          },
          totalAmount: {
            $sum: "$lineTotal",
          },
        },
      },
    ]),
  ]);

  return NextResponse.json({
    success: true,
    data: items.map(serializeLine),
    summary: {
      rows: summary[0]?.rows || 0,
      totalAmount: summary[0]?.totalAmount || 0,
    },
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}
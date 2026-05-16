// app/api/payments/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { QueryFilter } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString, escapeRegex } from "@/lib/crud-utils";
import CustomerModel, { ICustomer } from "@/models/Customer";
import PaymentModel from "@/models/Payment";
import SaleModel from "@/models/Sale";

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);

  const search = cleanString(searchParams.get("search"));
  const group = cleanString(searchParams.get("group")).toUpperCase();

  const customerFilter: QueryFilter<ICustomer> = {
    isActive: true,
  };

  if (search) {
    customerFilter.name = {
      $regex: escapeRegex(search),
      $options: "i",
    };
  }

  if (group === "SALE") {
    customerFilter.type = {
      $in: ["SALE", "BOTH"],
    };
  }

  if (group === "OUTLET") {
    customerFilter.type = {
      $in: ["DELIVERY", "BOTH"],
    };
  }

  const customers = await CustomerModel.find(customerFilter)
    .sort({ name: 1 })
    .lean();

  const customerIds = customers.map((customer) => customer._id);

  const [salesSummary, paymentsSummary] = await Promise.all([
    SaleModel.aggregate([
      {
        $match: {
          isVoided: false,
          customerId: {
            $in: customerIds,
          },
        },
      },
      {
        $group: {
          _id: "$customerId",
          sales: {
            $sum: "$totalAmount",
          },
          packs: {
            $sum: "$totalPacks",
          },
        },
      },
    ]),

    PaymentModel.aggregate([
      {
        $match: {
          isVoided: false,
          customerId: {
            $in: customerIds,
          },
        },
      },
      {
        $group: {
          _id: "$customerId",
          paid: {
            $sum: "$amount",
          },
        },
      },
    ]),
  ]);

  const salesMap = new Map(
    salesSummary.map((item) => [
      item._id.toString(),
      {
        sales: item.sales || 0,
        packs: item.packs || 0,
      },
    ])
  );

  const paymentsMap = new Map(
    paymentsSummary.map((item) => [
      item._id.toString(),
      {
        paid: item.paid || 0,
      },
    ])
  );

  const data = customers.map((customer) => {
    const id = customer._id.toString();
    const sales = salesMap.get(id)?.sales || 0;
    const paid = paymentsMap.get(id)?.paid || 0;
    const packs = salesMap.get(id)?.packs || 0;

    return {
      _id: id,
      customer: customer.name,
      type: customer.type,
      sales,
      paid,
      balance: sales - paid,
      packs,
    };
  });

  return NextResponse.json({
    success: true,
    data,
  });
}
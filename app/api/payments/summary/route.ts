// app/api/payments/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { QueryFilter } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { cleanString, escapeRegex } from "@/lib/crud-utils";
import {
  paymentPosition,
  saleLineUnitGroupFields,
} from "@/lib/payment-summary";
import CustomerModel, { ICustomer } from "@/models/Customer";
import PaymentModel from "@/models/Payment";
import SaleLineModel from "@/models/SaleLine";
import SaleModel from "@/models/Sale";

export async function GET(req: NextRequest) {
  const { response } = await requirePermission([
    "payments.view",
    "payments.manage",
  ]);

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
    customerFilter.outletId = { $type: "objectId" };
  }

  const customers = await CustomerModel.find(customerFilter)
    .sort({ name: 1 })
    .lean();

  const customerIds = customers.map((customer) => customer._id);

  const [salesSummary, paymentsSummary] = await Promise.all([
    SaleModel.aggregate([
      {
        $match: {
          isVoided: { $ne: true },
          customerId: {
            $in: customerIds,
          },
        },
      },
      {
        $lookup: {
          from: SaleLineModel.collection.name,
          localField: "_id",
          foreignField: "saleId",
          pipeline: [
            {
              $group: {
                _id: null,
                ...saleLineUnitGroupFields(),
              },
            },
          ],
          as: "lineUnits",
        },
      },
      {
        $set: {
          lineUnits: { $arrayElemAt: ["$lineUnits", 0] },
        },
      },
      {
        $group: {
          _id: "$customerId",
          sales: {
            $sum: "$totalAmount",
          },
          immediateCashSales: {
            $sum: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ["$receiptNumber", ""] },
                    regex: /^MOB-/,
                  },
                },
                { $ifNull: ["$paidAmount", 0] },
                0,
              ],
            },
          },
          packs: {
            $sum: {
              $ifNull: ["$lineUnits.packs", { $ifNull: ["$totalPacks", 0] }],
            },
          },
          pcs: {
            $sum: {
              $ifNull: ["$lineUnits.pcs", { $ifNull: ["$totalQty", 0] }],
            },
          },
        },
      },
    ]),

    PaymentModel.aggregate([
      {
        $match: {
          isVoided: { $ne: true },
          customerId: {
            $in: customerIds,
          },
        },
      },
      {
        $group: {
          _id: "$customerId",
          recordedPayments: {
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
        immediateCashSales: item.immediateCashSales || 0,
        packs: item.packs || 0,
        pcs: item.pcs || 0,
      },
    ]),
  );

  const paymentsMap = new Map(
    paymentsSummary.map((item) => [
      item._id.toString(),
      {
        recordedPayments: item.recordedPayments || 0,
      },
    ]),
  );

  const data = customers.map((customer) => {
    const id = customer._id.toString();
    const sales = salesMap.get(id)?.sales || 0;
    const position = paymentPosition({
      sales,
      immediateCashSales: salesMap.get(id)?.immediateCashSales || 0,
      recordedPayments: paymentsMap.get(id)?.recordedPayments || 0,
    });
    const packs = salesMap.get(id)?.packs || 0;
    const pcs = salesMap.get(id)?.pcs || 0;

    return {
      _id: id,
      customer: customer.name,
      type: customer.type,
      sales: position.sales,
      paid: position.paid,
      balance: position.balance,
      packs,
      pcs,
    };
  });

  return NextResponse.json({
    success: true,
    data,
  });
}

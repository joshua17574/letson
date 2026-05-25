// lib/dashboard.ts
import dbConnect from "@/lib/mongodb";

import CustomerModel from "@/models/Customer";
import DeliveryModel from "@/models/Delivery";
import PaymentModel from "@/models/Payment";
import PurchaseBatchModel from "@/models/PurchaseBatch";
import SaleModel from "@/models/Sale";
import SupplierModel from "@/models/Supplier";

const paymentAmountExpression = {
  $ifNull: [
    "$amountReceived",
    {
      $ifNull: [
        "$amountPaid",
        {
          $ifNull: ["$amount", 0],
        },
      ],
    },
  ],
};

function notVoidedFilter() {
  return {
    $or: [
      {
        isVoided: {
          $exists: false,
        },
      },
      {
        isVoided: false,
      },
    ],
  };
}

function getDateRanges() {
  const now = new Date();

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    todayStart,
    tomorrowStart,
    monthStart,
    nextMonthStart,
  };
}

function withDateRange(
  baseFilter: Record<string, any>,
  dateField: string,
  startDate: Date,
  endDate: Date
) {
  return {
    ...baseFilter,
    [dateField]: {
      $gte: startDate,
      $lt: endDate,
    },
  };
}

async function sumAmount(
  model: any,
  match: Record<string, any>,
  amountExpression: any
) {
  const result = await model.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: amountExpression,
        },
      },
    },
  ]);

  return Number(result[0]?.total || 0);
}

export async function getDashboardSummary() {
  await dbConnect();

  const {
    todayStart,
    tomorrowStart,
    monthStart,
    nextMonthStart,
  } = getDateRanges();

  const activeFilter = {
    isActive: true,
  };

  const saleFilter = notVoidedFilter();
  const paymentFilter = notVoidedFilter();
  const deliveryFilter = notVoidedFilter();
  const purchaseBatchFilter = notVoidedFilter();

  const [
    totalCustomers,
    totalSuppliers,

    totalSales,
    totalPayments,

    totalSupplierDeliveries,
    totalPurchaseBatches,

    todaySales,
    todayPayments,
    todaySupplierDeliveries,
    todayPurchaseBatches,

    thisMonthSales,
    thisMonthPayments,
    thisMonthSupplierDeliveries,
    thisMonthPurchaseBatches,
  ] = await Promise.all([
    CustomerModel.countDocuments(activeFilter),
    SupplierModel.countDocuments(activeFilter),

    sumAmount(SaleModel, saleFilter, "$totalAmount"),
    sumAmount(PaymentModel, paymentFilter, paymentAmountExpression),

    sumAmount(DeliveryModel, deliveryFilter, "$totalAmount"),
    sumAmount(PurchaseBatchModel, purchaseBatchFilter, "$totalAmount"),

    sumAmount(
      SaleModel,
      withDateRange(saleFilter, "createdAt", todayStart, tomorrowStart),
      "$totalAmount"
    ),
    sumAmount(
      PaymentModel,
      withDateRange(paymentFilter, "createdAt", todayStart, tomorrowStart),
      paymentAmountExpression
    ),
    sumAmount(
      DeliveryModel,
      withDateRange(deliveryFilter, "createdAt", todayStart, tomorrowStart),
      "$totalAmount"
    ),
    sumAmount(
      PurchaseBatchModel,
      withDateRange(purchaseBatchFilter, "createdAt", todayStart, tomorrowStart),
      "$totalAmount"
    ),

    sumAmount(
      SaleModel,
      withDateRange(saleFilter, "createdAt", monthStart, nextMonthStart),
      "$totalAmount"
    ),
    sumAmount(
      PaymentModel,
      withDateRange(paymentFilter, "createdAt", monthStart, nextMonthStart),
      paymentAmountExpression
    ),
    sumAmount(
      DeliveryModel,
      withDateRange(deliveryFilter, "createdAt", monthStart, nextMonthStart),
      "$totalAmount"
    ),
    sumAmount(
      PurchaseBatchModel,
      withDateRange(purchaseBatchFilter, "createdAt", monthStart, nextMonthStart),
      "$totalAmount"
    ),
  ]);

  const totalStockInPurchases = totalSupplierDeliveries + totalPurchaseBatches;
  const todayStockInPurchases = todaySupplierDeliveries + todayPurchaseBatches;
  const thisMonthStockInPurchases =
    thisMonthSupplierDeliveries + thisMonthPurchaseBatches;

  const outstandingReceivables = Math.max(totalSales - totalPayments, 0);

  return {
    totalCustomers,
    totalSuppliers,

    totalSales,
    totalPayments,
    outstandingReceivables,

    totalSupplierDeliveries,
    totalPurchaseBatches,
    totalStockInPurchases,

    // Keep this alias if older dashboard parts still use it.
    totalDeliveries: totalSupplierDeliveries,

    today: {
      sales: todaySales,
      payments: todayPayments,
      supplierDeliveries: todaySupplierDeliveries,
      purchaseBatches: todayPurchaseBatches,
      stockInPurchases: todayStockInPurchases,
    },

    thisMonth: {
      sales: thisMonthSales,
      payments: thisMonthPayments,
      supplierDeliveries: thisMonthSupplierDeliveries,
      purchaseBatches: thisMonthPurchaseBatches,
      stockInPurchases: thisMonthStockInPurchases,
    },
  };
}
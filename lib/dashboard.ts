// lib/dashboard.ts
import type { Document, Filter } from "mongodb";

import { getMongoDb } from "@/lib/mongodb";

type DashboardSummary = {
  totalCustomers: number;
  totalSuppliers: number;
  totalSales: number;
  totalDeliveries: number;
  totalPayments: number;
  outstandingReceivables: number;
  today: {
    sales: number;
    deliveries: number;
    payments: number;
  };
  thisMonth: {
    sales: number;
    deliveries: number;
    payments: number;
  };
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  date.setHours(23, 59, 59, 999);
  return date;
}

async function safeCount(
  collectionName: string,
  filter: Filter<Document> = {}
): Promise<number> {
  try {
    const db = await getMongoDb();

    return await db
      .collection<Document>(collectionName)
      .countDocuments(filter);
  } catch (error) {
    console.error(`safeCount error in ${collectionName}:`, error);
    return 0;
  }
}

async function safeSum(
  collectionName: string,
  field: string,
  filter: Filter<Document> = {}
): Promise<number> {
  try {
    const db = await getMongoDb();

    const result = await db
      .collection<Document>(collectionName)
      .aggregate<{ total: number }>([
        {
          $match: filter,
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: `$${field}`,
            },
          },
        },
      ])
      .toArray();

    return Number(result[0]?.total ?? 0);
  } catch (error) {
    console.error(`safeSum error in ${collectionName}.${field}:`, error);
    return 0;
  }
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const monthStart = startOfMonth();
  const monthEnd = endOfMonth();

  const totalCustomers = await safeCount("customers", {
    isActive: { $ne: false },
  });

  const totalSuppliers = await safeCount("suppliers", {
    isActive: { $ne: false },
  });

  const totalSales = await safeSum("sales", "totalAmount", {
    status: { $ne: "VOIDED" },
  });

  const totalDeliveries = await safeSum("deliveries", "totalAmount", {
    isVoided: { $ne: true },
  });

  const totalPayments = await safeSum("payments", "amount");

  const balanceFromSales = await safeSum("sales", "balance", {
    status: { $ne: "VOIDED" },
  });

  const outstandingReceivables =
    balanceFromSales > 0
      ? balanceFromSales
      : Math.max(totalSales - totalPayments, 0);

  const todaySales = await safeSum("sales", "totalAmount", {
    status: { $ne: "VOIDED" },
    saleDate: {
      $gte: todayStart,
      $lte: todayEnd,
    },
  });

  const todayDeliveries = await safeSum("deliveries", "totalAmount", {
    isVoided: { $ne: true },
    deliveryDate: {
      $gte: todayStart,
      $lte: todayEnd,
    },
  });

  const todayPayments = await safeSum("payments", "amount", {
    paymentDate: {
      $gte: todayStart,
      $lte: todayEnd,
    },
  });

  const monthSales = await safeSum("sales", "totalAmount", {
    status: { $ne: "VOIDED" },
    saleDate: {
      $gte: monthStart,
      $lte: monthEnd,
    },
  });

  const monthDeliveries = await safeSum("deliveries", "totalAmount", {
    isVoided: { $ne: true },
    deliveryDate: {
      $gte: monthStart,
      $lte: monthEnd,
    },
  });

  const monthPayments = await safeSum("payments", "amount", {
    paymentDate: {
      $gte: monthStart,
      $lte: monthEnd,
    },
  });

  return {
    totalCustomers,
    totalSuppliers,
    totalSales,
    totalDeliveries,
    totalPayments,
    outstandingReceivables,
    today: {
      sales: todaySales,
      deliveries: todayDeliveries,
      payments: todayPayments,
    },
    thisMonth: {
      sales: monthSales,
      deliveries: monthDeliveries,
      payments: monthPayments,
    },
  };
}
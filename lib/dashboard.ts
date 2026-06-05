// lib/dashboard.ts
import dbConnect from "@/lib/mongodb";
import BodegaProductModel from "@/models/BodegaProduct";
import CustomerModel from "@/models/Customer";
import DeliveryModel from "@/models/Delivery";
import ExpenseModel from "@/models/Expense";
import PaymentModel from "@/models/Payment";
import PurchaseBatchModel from "@/models/PurchaseBatch";
import SaleModel from "@/models/Sale";
import SlicingBatchModel from "@/models/SlicingBatch";
import StandardPackingModel from "@/models/StandardPacking";
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

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    todayStart,
    tomorrowStart,
    yesterdayStart,
    monthStart,
    nextMonthStart,
  };
}

function withDateRange(
  baseFilter: Record<string, unknown>,
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
  match: Record<string, unknown>,
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

  return numberValue(result[0]?.total);
}

function formatStockBreakdown(stockQty: number, packSize: number) {
  const totalPcs = Math.max(0, Math.trunc(numberValue(stockQty)));
  const pcsPerPack = Math.max(0, Math.trunc(numberValue(packSize)));

  if (pcsPerPack > 1) {
    const packs = Math.floor(totalPcs / pcsPerPack);
    const loosePcs = totalPcs % pcsPerPack;

    return {
      isPackBased: true,
      packs,
      loosePcs,
      totalPcs,
      packSize: pcsPerPack,
      display: `${packs.toLocaleString()} packs${loosePcs ? ` / ${loosePcs.toLocaleString()} pcs` : ""}`,
      detail: `${totalPcs.toLocaleString()} pcs total`,
    };
  }

  return {
    isPackBased: false,
    packs: 0,
    loosePcs: 0,
    totalPcs,
    packSize: 0,
    display: totalPcs.toLocaleString(),
    detail: "stock qty",
  };
}

function plainDate(value: unknown) {
  if (!value) return "";
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString();
}

async function getBodegaStockSummary() {
  const [products, standards] = await Promise.all([
    BodegaProductModel.find({ isActive: true })
      .select("name stockQty buyingPrice sellingPrice")
      .sort({ name: 1 })
      .lean(),
    StandardPackingModel.find({ isActive: true })
      .select("productId standardPacking")
      .lean(),
  ]);

  const packSizeByProductId = new Map<string, number>();

  for (const standard of standards as any[]) {
    const productId = String(standard.productId || "");
    const standardPacking = Math.trunc(numberValue(standard.standardPacking));

    if (productId && standardPacking > 1) {
      packSizeByProductId.set(productId, standardPacking);
    }
  }

  const stockRows = (products as any[]).map((product) => {
    const productId = String(product._id);
    const stockQty = numberValue(product.stockQty);
    const buyingPrice = numberValue(product.buyingPrice);
    const sellingPrice = numberValue(product.sellingPrice);
    const packSize = packSizeByProductId.get(productId) || 0;
    const stock = formatStockBreakdown(stockQty, packSize);
    const inventoryCostValue = stockQty * buyingPrice;
    const inventorySellingValue = stock.isPackBased
      ? stock.packs * sellingPrice + stock.loosePcs * (sellingPrice / stock.packSize)
      : stockQty * sellingPrice;

    const lowStockThreshold = stock.isPackBased ? stock.packSize * 2 : 10;

    return {
      _id: productId,
      name: String(product.name || ""),
      stockQty,
      buyingPrice,
      sellingPrice,
      inventoryCostValue,
      inventorySellingValue,
      isPackBased: stock.isPackBased,
      packSize: stock.packSize,
      packs: stock.packs,
      loosePcs: stock.loosePcs,
      display: stock.display,
      detail: stock.detail,
      isLowStock: stockQty > 0 && stockQty <= lowStockThreshold,
      isOutOfStock: stockQty <= 0,
    };
  });

  const totalCostValue = stockRows.reduce(
    (sum, product) => sum + product.inventoryCostValue,
    0
  );
  const totalSellingValue = stockRows.reduce(
    (sum, product) => sum + product.inventorySellingValue,
    0
  );
  const totalStockPcs = stockRows.reduce((sum, product) => sum + product.stockQty, 0);
  const slicedProducts = stockRows.filter((product) => product.isPackBased);
  const regularProducts = stockRows.filter((product) => !product.isPackBased);
  const lowStockProducts = stockRows
    .filter((product) => product.isLowStock || product.isOutOfStock)
    .sort((a, b) => a.stockQty - b.stockQty)
    .slice(0, 8);
  const topInventoryProducts = stockRows
    .sort((a, b) => b.inventoryCostValue - a.inventoryCostValue)
    .slice(0, 8);

  return {
    totalProducts: stockRows.length,
    totalStockPcs,
    totalCostValue,
    totalSellingValue,
    possibleMarkupValue: Math.max(totalSellingValue - totalCostValue, 0),
    slicedProductCount: slicedProducts.length,
    regularProductCount: regularProducts.length,
    lowStockCount: stockRows.filter((product) => product.isLowStock).length,
    outOfStockCount: stockRows.filter((product) => product.isOutOfStock).length,
    lowStockProducts,
    topInventoryProducts,
  };
}

async function getRecentActivity() {
  const [recentSales, recentPayments, recentExpenses, recentSlicing] =
    await Promise.all([
      SaleModel.find(notVoidedFilter())
        .select("receiptNumber totalAmount paidAmount balance status source saleDate createdAt customerId")
        .populate("customerId", "name")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      PaymentModel.find(notVoidedFilter())
        .select("amount appliedAmount unappliedAmount referenceNumber paymentDate createdAt customerId")
        .populate("customerId", "name")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      ExpenseModel.find({ isActive: true })
        .select("name type amount expenseDate createdAt")
        .sort({ expenseDate: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      SlicingBatchModel.find(notVoidedFilter())
        .select("slicingDate totalHeads totalActualPcs totalPacks totalVariance slicer packer createdAt")
        .sort({ slicingDate: -1, createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

  return {
    sales: (recentSales as any[]).map((sale) => ({
      _id: String(sale._id),
      title: String(sale.receiptNumber || "Sale"),
      name: String(sale.customerId?.name || "Customer"),
      amount: numberValue(sale.totalAmount),
      balance: numberValue(sale.balance),
      status: String(sale.status || ""),
      source: String(sale.source || ""),
      date: plainDate(sale.saleDate || sale.createdAt),
    })),
    payments: (recentPayments as any[]).map((payment) => ({
      _id: String(payment._id),
      title: String(payment.referenceNumber || "Payment"),
      name: String(payment.customerId?.name || "Customer"),
      amount: numberValue(payment.amount || payment.appliedAmount),
      unappliedAmount: numberValue(payment.unappliedAmount),
      date: plainDate(payment.paymentDate || payment.createdAt),
    })),
    expenses: (recentExpenses as any[]).map((expense) => ({
      _id: String(expense._id),
      title: String(expense.name || "Expense"),
      type: String(expense.type || "OTHERS"),
      amount: numberValue(expense.amount),
      date: plainDate(expense.expenseDate || expense.createdAt),
    })),
    slicing: (recentSlicing as any[]).map((batch) => ({
      _id: String(batch._id),
      title: `${numberValue(batch.totalHeads).toLocaleString()} heads sliced`,
      totalHeads: numberValue(batch.totalHeads),
      totalActualPcs: numberValue(batch.totalActualPcs),
      totalPacks: numberValue(batch.totalPacks),
      totalVariance: numberValue(batch.totalVariance),
      slicer: String(batch.slicer || ""),
      packer: String(batch.packer || ""),
      date: plainDate(batch.slicingDate || batch.createdAt),
    })),
  };
}

export async function getDashboardSummary() {
  await dbConnect();

  const {
    todayStart,
    tomorrowStart,
    yesterdayStart,
    monthStart,
    nextMonthStart,
  } = getDateRanges();

  const activeFilter = { isActive: true };
  const saleFilter = notVoidedFilter();
  const paymentFilter = notVoidedFilter();
  const deliveryFilter = notVoidedFilter();
  const purchaseBatchFilter = notVoidedFilter();
  const expenseFilter = { isActive: true };
  const slicingFilter = notVoidedFilter();

  const [
    totalCustomers,
    totalSuppliers,
    totalSales,
    totalPayments,
    totalSupplierDeliveries,
    totalPurchaseBatches,
    totalExpenses,
    todaySales,
    todayPayments,
    todaySupplierDeliveries,
    todayPurchaseBatches,
    todayExpenses,
    todaySlicingHeads,
    todaySlicingPacks,
    yesterdaySales,
    yesterdayPayments,
    yesterdayExpenses,
    thisMonthSales,
    thisMonthPayments,
    thisMonthSupplierDeliveries,
    thisMonthPurchaseBatches,
    thisMonthExpenses,
    thisMonthSlicingHeads,
    thisMonthSlicingPacks,
    bodegaStock,
    recent,
  ] = await Promise.all([
    CustomerModel.countDocuments(activeFilter),
    SupplierModel.countDocuments(activeFilter),
    sumAmount(SaleModel, saleFilter, "$totalAmount"),
    sumAmount(PaymentModel, paymentFilter, paymentAmountExpression),
    sumAmount(DeliveryModel, deliveryFilter, "$totalAmount"),
    sumAmount(PurchaseBatchModel, purchaseBatchFilter, "$totalAmount"),
    sumAmount(ExpenseModel, expenseFilter, "$amount"),
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
      ExpenseModel,
      withDateRange(expenseFilter, "expenseDate", todayStart, tomorrowStart),
      "$amount"
    ),
    sumAmount(
      SlicingBatchModel,
      withDateRange(slicingFilter, "slicingDate", todayStart, tomorrowStart),
      "$totalHeads"
    ),
    sumAmount(
      SlicingBatchModel,
      withDateRange(slicingFilter, "slicingDate", todayStart, tomorrowStart),
      "$totalPacks"
    ),
    sumAmount(
      SaleModel,
      withDateRange(saleFilter, "createdAt", yesterdayStart, todayStart),
      "$totalAmount"
    ),
    sumAmount(
      PaymentModel,
      withDateRange(paymentFilter, "createdAt", yesterdayStart, todayStart),
      paymentAmountExpression
    ),
    sumAmount(
      ExpenseModel,
      withDateRange(expenseFilter, "expenseDate", yesterdayStart, todayStart),
      "$amount"
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
    sumAmount(
      ExpenseModel,
      withDateRange(expenseFilter, "expenseDate", monthStart, nextMonthStart),
      "$amount"
    ),
    sumAmount(
      SlicingBatchModel,
      withDateRange(slicingFilter, "slicingDate", monthStart, nextMonthStart),
      "$totalHeads"
    ),
    sumAmount(
      SlicingBatchModel,
      withDateRange(slicingFilter, "slicingDate", monthStart, nextMonthStart),
      "$totalPacks"
    ),
    getBodegaStockSummary(),
    getRecentActivity(),
  ]);

  const totalStockInPurchases = totalSupplierDeliveries + totalPurchaseBatches;
  const todayStockInPurchases = todaySupplierDeliveries + todayPurchaseBatches;
  const thisMonthStockInPurchases =
    thisMonthSupplierDeliveries + thisMonthPurchaseBatches;
  const outstandingReceivables = Math.max(totalSales - totalPayments, 0);
  const todayOperatingCash = todayPayments - todayExpenses;
  const thisMonthOperatingCash = thisMonthPayments - thisMonthExpenses;

  return {
    totalCustomers,
    totalSuppliers,
    totalSales,
    totalPayments,
    totalExpenses,
    outstandingReceivables,
    totalSupplierDeliveries,
    totalPurchaseBatches,
    totalStockInPurchases,
    totalDeliveries: totalSupplierDeliveries,
    today: {
      sales: todaySales,
      payments: todayPayments,
      supplierDeliveries: todaySupplierDeliveries,
      purchaseBatches: todayPurchaseBatches,
      stockInPurchases: todayStockInPurchases,
      expenses: todayExpenses,
      operatingCash: todayOperatingCash,
      slicingHeads: todaySlicingHeads,
      slicingPacks: todaySlicingPacks,
    },
    yesterday: {
      sales: yesterdaySales,
      payments: yesterdayPayments,
      expenses: yesterdayExpenses,
    },
    thisMonth: {
      sales: thisMonthSales,
      payments: thisMonthPayments,
      supplierDeliveries: thisMonthSupplierDeliveries,
      purchaseBatches: thisMonthPurchaseBatches,
      stockInPurchases: thisMonthStockInPurchases,
      expenses: thisMonthExpenses,
      operatingCash: thisMonthOperatingCash,
      slicingHeads: thisMonthSlicingHeads,
      slicingPacks: thisMonthSlicingPacks,
    },
    bodegaStock,
    recent,
  };
}

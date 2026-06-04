// app/api/inventory/bodega/route.ts
import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanString, escapeRegex } from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";
import StandardPackingModel from "@/models/StandardPacking";

function getTransactionSign(type: string) {
  if (type === "STOCK_IN") return "IN";
  if (type === "STOCK_OUT") return "OUT";
  if (type === "VOID_REVERSAL") return "OUT";

  return "NONE";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPackBreakdown(quantityValue: unknown, pcsPerPackValue: unknown) {
  const quantity = Math.max(0, Math.trunc(numberValue(quantityValue)));
  const pcsPerPack = Math.max(0, Math.trunc(numberValue(pcsPerPackValue)));

  if (pcsPerPack <= 0) {
    return {
      pcs: quantity,
      packs: 0,
      loosePcs: quantity,
    };
  }

  const packs = Math.floor(quantity / pcsPerPack);
  const loosePcs = quantity - packs * pcsPerPack;

  return {
    pcs: quantity,
    packs,
    loosePcs,
  };
}

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);

  const search = cleanString(searchParams.get("search"));
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

  const productFilter: Record<string, any> = {
    isActive: true,
  };

  if (search) {
    productFilter.name = {
      $regex: escapeRegex(search),
      $options: "i",
    };
  }

  const products = await BodegaProductModel.find(productFilter)
    .sort({ name: 1 })
    .lean();

  const productIds = products.map((product) => product._id);

  const packSizeByProductId = new Map<string, number>();

  if (productIds.length > 0) {
    const standards = await StandardPackingModel.find({
      isActive: true,
      productId: {
        $in: productIds,
      },
    })
      .select("productId standardPacking")
      .lean();

    for (const standard of standards) {
      const productId = standard.productId?.toString?.() || "";
      const packSize = Math.max(0, Math.trunc(numberValue(standard.standardPacking)));

      if (productId && packSize > 0 && !packSizeByProductId.has(productId)) {
        packSizeByProductId.set(productId, packSize);
      }
    }
  }

  const transactionFilter: Record<string, any> = {
    bodegaProductId: {
      $in: productIds,
    },
  };

  if (dateFrom || dateTo) {
    transactionFilter.createdAt = {};

    if (dateFrom) {
      transactionFilter.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      transactionFilter.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  const transactions = await BodegaStockTransactionModel.find(transactionFilter)
    .sort({ createdAt: -1 })
    .lean();

  const movementMap = new Map<
    string,
    {
      stockIn: number;
      stockOut: number;
      latestDate?: Date;
    }
  >();

  for (const transaction of transactions) {
    const productId = transaction.bodegaProductId?.toString?.() || "";
    const sign = getTransactionSign(transaction.type);
    const quantity = numberValue(transaction.quantity);

    const current = movementMap.get(productId) || {
      stockIn: 0,
      stockOut: 0,
      latestDate: undefined,
    };

    if (sign === "IN") {
      current.stockIn += quantity;
    }

    if (sign === "OUT") {
      current.stockOut += quantity;
    }

    if (
      transaction.createdAt &&
      (!current.latestDate ||
        new Date(transaction.createdAt) > new Date(current.latestDate))
    ) {
      current.latestDate = transaction.createdAt;
    }

    movementMap.set(productId, current);
  }

  const data = products.map((product) => {
    const id = product._id.toString();

    const movement = movementMap.get(id) || {
      stockIn: 0,
      stockOut: 0,
      latestDate: product.createdAt,
    };

    const packSize = packSizeByProductId.get(id) || 0;
    const isPackProduct = packSize > 0;

    const stockInBreakdown = getPackBreakdown(movement.stockIn, packSize);
    const stockOutBreakdown = getPackBreakdown(movement.stockOut, packSize);
    const currentStockBreakdown = getPackBreakdown(product.stockQty, packSize);

    const pricePerPack = numberValue(product.sellingPrice);
    const fallbackUnitPrice = numberValue(product.sellingPrice || product.buyingPrice || 0);
    const pricePerPcs = isPackProduct && packSize > 0 ? pricePerPack / packSize : 0;

    return {
      _id: id,
      product: product.name,

      // Raw/base quantity remains PCS for sliced products. It remains heads/unit for whole chicken items.
      stockIn: numberValue(movement.stockIn),
      stockOut: numberValue(movement.stockOut),
      currentStock: numberValue(product.stockQty),

      // Pack-aware display values for sliced products such as C10, C59, and C99.
      isPackProduct,
      packSize,
      stockInPcs: stockInBreakdown.pcs,
      stockInPacks: stockInBreakdown.packs,
      stockInLoosePcs: stockInBreakdown.loosePcs,
      stockOutPcs: stockOutBreakdown.pcs,
      stockOutPacks: stockOutBreakdown.packs,
      stockOutLoosePcs: stockOutBreakdown.loosePcs,
      currentStockPcs: currentStockBreakdown.pcs,
      currentStockPacks: currentStockBreakdown.packs,
      currentStockLoosePcs: currentStockBreakdown.loosePcs,

      // Product selling price is treated as price per pack for pack products.
      price: isPackProduct ? pricePerPack : fallbackUnitPrice,
      pricePerPack: isPackProduct ? pricePerPack : 0,
      pricePerPcs,

      dateAdded: movement.latestDate
        ? new Date(movement.latestDate).toISOString()
        : product.createdAt
          ? new Date(product.createdAt).toISOString()
          : undefined,
    };
  });

  const totals = data.reduce(
    (sum, row) => ({
      stockIn: sum.stockIn + row.stockIn,
      stockOut: sum.stockOut + row.stockOut,
      currentStock: sum.currentStock + row.currentStock,
    }),
    {
      stockIn: 0,
      stockOut: 0,
      currentStock: 0,
    }
  );

  return NextResponse.json({
    success: true,
    data,
    totals,
  });
}

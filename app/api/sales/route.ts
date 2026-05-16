// app/api/sales/route.ts
import { NextRequest, NextResponse } from "next/server";
import { QueryFilter, isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import {
  cleanNumber,
  cleanString,
  escapeRegex,
  getPagination,
} from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";
import CustomerModel from "@/models/Customer";
import InventoryTransactionModel from "@/models/InventoryTransaction";
import ProductModel from "@/models/Product";
import SaleModel, { ISale, SaleSource } from "@/models/Sale";
import SaleLineModel from "@/models/SaleLine";
import SlicingStandardModel from "@/models/SlicingStandard";

type ChickenSaleItemInput = {
  productId: string;
  packs: number;
  pricePerPack: number;
  packSize?: number;
  remarks?: string;
};

type BodegaSaleItemInput = {
  bodegaProductId: string;
  quantity: number;
  price: number;
  remarks?: string;
};

function isSaleSource(value: string): value is SaleSource {
  return ["CHICKEN", "BODEGA", "MIXED"].includes(value);
}

function serializeSale(sale: any) {
  return {
    _id: sale._id.toString(),
    receiptNumber: sale.receiptNumber,
    customerId:
      sale.customerId?._id?.toString?.() || sale.customerId?.toString?.(),
    customerName: sale.customerId?.name || "",
    saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString() : undefined,
    source: sale.source,
    totalAmount: sale.totalAmount || 0,
    paidAmount: sale.paidAmount || 0,
    balance: sale.balance || 0,
    totalPacks: sale.totalPacks || 0,
    totalQty: sale.totalQty || 0,
    remarks: sale.remarks || "",
    status: sale.status,
    createdByName: sale.createdBy?.name || sale.createdBy?.username || "",
  };
}

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));
  const customerId = cleanString(searchParams.get("customerId"));
  const receiptNumber = cleanString(searchParams.get("receiptNumber"));
  const sourceInput = cleanString(searchParams.get("source")).toUpperCase();

  const filter: QueryFilter<ISale> = {
    isVoided: false,
  };

  if (dateFrom || dateTo) {
    filter.saleDate = {};

    if (dateFrom) {
      filter.saleDate.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      filter.saleDate.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  if (customerId && customerId !== "ALL" && isValidObjectId(customerId)) {
    filter.customerId = customerId;
  }

  if (receiptNumber) {
    filter.receiptNumber = {
      $regex: escapeRegex(receiptNumber),
      $options: "i",
    };
  }

  if (isSaleSource(sourceInput)) {
    filter.source = sourceInput;
  }

  const [items, total, summary] = await Promise.all([
    SaleModel.find(filter)
      .populate("customerId", "name")
      .populate("createdBy", "name username")
      .sort({ saleDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    SaleModel.countDocuments(filter),

    SaleModel.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: null,
          rows: {
            $sum: 1,
          },
          filteredTotal: {
            $sum: "$totalAmount",
          },
        },
      },
    ]),
  ]);

  return NextResponse.json({
    success: true,
    data: items.map(serializeSale),
    summary: {
      rows: summary[0]?.rows || 0,
      filteredTotal: summary[0]?.filteredTotal || 0,
    },
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

  const body = await req.json();

  const sourceInput = cleanString(body.source).toUpperCase();
  const customerId = cleanString(body.customerId);
  const saleDate = cleanString(body.saleDate);
  const receiptNumber = cleanString(body.receiptNumber);
  const remarks = cleanString(body.remarks);

  if (sourceInput !== "CHICKEN" && sourceInput !== "BODEGA") {
    return NextResponse.json(
      {
        success: false,
        message: "Sale source must be CHICKEN or BODEGA.",
      },
      { status: 400 }
    );
  }

  if (!customerId || !isValidObjectId(customerId)) {
    return NextResponse.json(
      {
        success: false,
        message: "Valid customer is required.",
      },
      { status: 400 }
    );
  }

  if (!saleDate) {
    return NextResponse.json(
      {
        success: false,
        message: "Sale date is required.",
      },
      { status: 400 }
    );
  }

  if (!receiptNumber) {
    return NextResponse.json(
      {
        success: false,
        message: "Receipt number is required.",
      },
      { status: 400 }
    );
  }

  const customerExists = await CustomerModel.exists({
    _id: customerId,
    isActive: true,
  });

  if (!customerExists) {
    return NextResponse.json(
      {
        success: false,
        message: "Customer not found.",
      },
      { status: 404 }
    );
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (rawItems.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: "At least one sale item is required.",
      },
      { status: 400 }
    );
  }

  let totalAmount = 0;
  let totalPacks = 0;
  let totalQty = 0;

  const preparedLines: any[] = [];

  if (sourceInput === "CHICKEN") {
    for (const rawItem of rawItems as ChickenSaleItemInput[]) {
      const productId = cleanString(rawItem.productId);
      const packs = cleanNumber(rawItem.packs);
      const pricePerPack = cleanNumber(rawItem.pricePerPack);
      const lineRemarks = cleanString(rawItem.remarks);

      if (!productId || !isValidObjectId(productId)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid chicken product.",
          },
          { status: 400 }
        );
      }

      if (packs <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Packs must be greater than zero.",
          },
          { status: 400 }
        );
      }

      const product: any = await ProductModel.findOne({
        _id: productId,
        isActive: true,
      }).populate("categoryId", "name");

      if (!product) {
        return NextResponse.json(
          {
            success: false,
            message: "Chicken product not found.",
          },
          { status: 404 }
        );
      }

      const standard = await SlicingStandardModel.findOne({
        productId: product._id,
        isActive: true,
      }).sort({ createdAt: -1 });

      const packSize =
        cleanNumber(rawItem.packSize) ||
        Number(standard?.standardPacking || 0);

      if (packSize <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: `No valid standard packing found for ${product.name}.`,
          },
          { status: 400 }
        );
      }

      const stockPcsOut = packs * packSize;

      if (product.stockPcs < stockPcsOut) {
        return NextResponse.json(
          {
            success: false,
            message: `${product.name} does not have enough stock. Available packs: ${Math.floor(
              product.stockPcs / packSize
            )}.`,
          },
          { status: 400 }
        );
      }

      const lineTotal = packs * pricePerPack;

      totalAmount += lineTotal;
      totalPacks += packs;
      totalQty += packs;

      preparedLines.push({
        source: "CHICKEN",
        product,
        productId: product._id,
        categoryId: product.categoryId?._id,
        categoryName: product.categoryId?.name || "",
        productName: product.name,
        qty: packs,
        price: pricePerPack,
        lineTotal,
        stockUnit: "PACK",
        packSize,
        stockPcsOut,
        remarks: lineRemarks,
      });
    }
  }

  if (sourceInput === "BODEGA") {
    for (const rawItem of rawItems as BodegaSaleItemInput[]) {
      const bodegaProductId = cleanString(rawItem.bodegaProductId);
      const quantity = cleanNumber(rawItem.quantity);
      const price = cleanNumber(rawItem.price);
      const lineRemarks = cleanString(rawItem.remarks);

      if (!bodegaProductId || !isValidObjectId(bodegaProductId)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid bodega product.",
          },
          { status: 400 }
        );
      }

      if (quantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Quantity must be greater than zero.",
          },
          { status: 400 }
        );
      }

      const product: any = await BodegaProductModel.findOne({
        _id: bodegaProductId,
        isActive: true,
      }).populate("categoryId", "name");

      if (!product) {
        return NextResponse.json(
          {
            success: false,
            message: "Bodega product not found.",
          },
          { status: 404 }
        );
      }

      if (product.stockQty < quantity) {
        return NextResponse.json(
          {
            success: false,
            message: `${product.name} does not have enough stock. Available quantity: ${product.stockQty}.`,
          },
          { status: 400 }
        );
      }

      const lineTotal = quantity * price;

      totalAmount += lineTotal;
      totalQty += quantity;

      preparedLines.push({
        source: "BODEGA",
        product,
        bodegaProductId: product._id,
        categoryId: product.categoryId?._id,
        categoryName: product.categoryId?.name || "",
        productName: product.name,
        qty: quantity,
        price,
        lineTotal,
        stockUnit: "QTY",
        packSize: 0,
        stockPcsOut: 0,
        remarks: lineRemarks,
      });
    }
  }

  const sale = await SaleModel.create({
    receiptNumber,
    customerId,
    saleDate: new Date(saleDate),
    source: sourceInput,
    totalAmount,
    paidAmount: 0,
    balance: totalAmount,
    totalPacks,
    totalQty,
    remarks,
    status: "UNPAID",
    createdBy: session?.user?.id,
  });

  const saleLinesToInsert = [];
  const inventoryTransactions = [];
  const bodegaTransactions = [];

  for (const line of preparedLines) {
    saleLinesToInsert.push({
      saleId: sale._id,
      source: line.source,
      productId: line.productId,
      bodegaProductId: line.bodegaProductId,
      categoryId: line.categoryId,
      categoryName: line.categoryName,
      productName: line.productName,
      qty: line.qty,
      price: line.price,
      lineTotal: line.lineTotal,
      stockUnit: line.stockUnit,
      packSize: line.packSize,
      stockPcsOut: line.stockPcsOut,
      remarks: line.remarks,
    });

    if (line.source === "CHICKEN") {
      const product = line.product;
      const previousStock = product.stockPcs;

      product.stockPcs -= line.stockPcsOut;
      await product.save();

      inventoryTransactions.push({
        productId: product._id,
        type: "SALE",
        unit: "PCS",
        quantity: line.stockPcsOut,
        previousStock,
        newStock: product.stockPcs,
        remarks: `SALE ${receiptNumber}`,
        referenceType: "SALE",
        referenceId: sale._id,
        createdBy: session?.user?.id,
      });
    }

    if (line.source === "BODEGA") {
      const product = line.product;
      const previousStock = product.stockQty;

      product.stockQty -= line.qty;
      await product.save();

      bodegaTransactions.push({
        bodegaProductId: product._id,
        type: "SALE",
        quantity: line.qty,
        previousStock,
        newStock: product.stockQty,
        remarks: `SALE ${receiptNumber}`,
        referenceType: "SALE",
        referenceId: sale._id,
        createdBy: session?.user?.id,
      });
    }
  }

  await SaleLineModel.insertMany(saleLinesToInsert);

  if (inventoryTransactions.length > 0) {
    await InventoryTransactionModel.insertMany(inventoryTransactions);
  }

  if (bodegaTransactions.length > 0) {
    await BodegaStockTransactionModel.insertMany(bodegaTransactions);
  }

  const populatedSale = await SaleModel.findById(sale._id)
    .populate("customerId", "name")
    .populate("createdBy", "name username")
    .lean();

  return NextResponse.json(
    {
      success: true,
      message: "Sale created successfully.",
      data: serializeSale(populatedSale),
    },
    { status: 201 }
  );
}
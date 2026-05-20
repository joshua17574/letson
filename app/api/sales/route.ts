// app/api/sales/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

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
import SaleModel from "@/models/Sale";
// import SaleItemModel from "@/models/SaleItem";

type SaleSource = "CHICKEN" | "BODEGA";

type SaleItemInput = {
  productId?: string;
  bodegaProductId?: string;

  qty?: number;
  quantity?: number;
  packs?: number;

  price?: number;
  unitPrice?: number;
  pricePerPack?: number;

  packSize?: number;
};

function serializeSale(sale: any) {
  return {
    _id: sale._id.toString(),

    customerId:
      sale.customerId?._id?.toString?.() || sale.customerId?.toString?.(),
    customerName: sale.customerId?.name || "",

    source: sale.source || "CHICKEN",
    receiptNumber: sale.receiptNumber || "",

    saleDate: sale.saleDate
      ? new Date(sale.saleDate).toISOString()
      : undefined,

    totalPacks: Number(sale.totalPacks || sale.totalQty || 0),
    totalQty: Number(sale.totalQty || sale.totalPacks || 0),
    totalAmount: Number(sale.totalAmount || 0),

    paidAmount: Number(sale.paidAmount || 0),
    balance: Number(sale.balance || 0),
    status: sale.status || "UNPAID",

    remarks: sale.remarks || "",

    createdAt: sale.createdAt
      ? new Date(sale.createdAt).toISOString()
      : undefined,

    updatedAt: sale.updatedAt
      ? new Date(sale.updatedAt).toISOString()
      : undefined,
  };
}

function getCategoryName(product: any) {
  return (
    product.categoryName ||
    product.categoryId?.name ||
    product.category?.name ||
    ""
  );
}

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const source = cleanString(searchParams.get("source")).toUpperCase();
  const customer = cleanString(searchParams.get("customer"));
  const receiptNumber = cleanString(searchParams.get("receiptNumber"));
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));
  const status = cleanString(searchParams.get("status")).toUpperCase();

  const filter: Record<string, any> = {
    isVoided: false,
  };

  if (source === "CHICKEN" || source === "BODEGA") {
    filter.source = source;
  }

  if (receiptNumber) {
    filter.receiptNumber = {
      $regex: escapeRegex(receiptNumber),
      $options: "i",
    };
  }

  if (status && status !== "ALL") {
    filter.status = status;
  }

  if (dateFrom || dateTo) {
    filter.saleDate = {};

    if (dateFrom) {
      filter.saleDate.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      filter.saleDate.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
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

    filter.customerId = {
      $in: customers.map((item) => item._id),
    };
  }

  const [items, total] = await Promise.all([
    SaleModel.find(filter)
      .populate("customerId", "name")
      .sort({ saleDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    SaleModel.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: items.map(serializeSale),
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
  const source: SaleSource = sourceInput === "BODEGA" ? "BODEGA" : "CHICKEN";

  const customerId = cleanString(body.customerId);
  const saleDate = cleanString(body.saleDate);
  const receiptNumber = cleanString(body.receiptNumber);
  const remarks = cleanString(body.remarks);

  const items: SaleItemInput[] = Array.isArray(body.items) ? body.items : [];

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

  if (items.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: "At least one sale item is required.",
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

  let totalQty = 0;
  let totalAmount = 0;

  const preparedItems = [];

  for (const item of items) {
    const bodegaProductId = cleanString(
      item.bodegaProductId || item.productId || ""
    );

    if (!bodegaProductId || !isValidObjectId(bodegaProductId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid bodega product in sale item.",
        },
        { status: 400 }
      );
    }

    const product = await BodegaProductModel.findOne({
      _id: bodegaProductId,
      isActive: true,
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          message: "Selected bodega product was not found.",
        },
        { status: 404 }
      );
    }

    const qty = cleanNumber(item.quantity || item.packs || item.qty);
    const price = cleanNumber(
      item.pricePerPack || item.price || item.unitPrice
    );
    const packSize = cleanNumber(item.packSize) || 1;

    if (qty <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Quantity must be greater than zero for ${product.name}.`,
        },
        { status: 400 }
      );
    }

    if (price <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Price must be greater than zero for ${product.name}.`,
        },
        { status: 400 }
      );
    }

    const previousStock = Number(product.stockQty || 0);

    if (previousStock < qty) {
      return NextResponse.json(
        {
          success: false,
          message: `Not enough stock for ${product.name}. Available: ${previousStock}.`,
        },
        { status: 400 }
      );
    }

    const lineTotal = qty * price;

    totalQty += qty;
    totalAmount += lineTotal;

    preparedItems.push({
      product,
      productId: product._id,
      bodegaProductId: product._id,
      productName: product.name,
      categoryName: getCategoryName(product),
      qty,
      packs: qty,
      quantity: qty,
      price,
      pricePerPack: price,
      unitPrice: price,
      packSize,
      lineTotal,
      previousStock,
      newStock: previousStock - qty,
    });
  }

  const sale = await SaleModel.create({
    source,
    customerId,
    saleDate: new Date(saleDate),
    receiptNumber,

    totalPacks: totalQty,
    totalQty,
    totalAmount,

    paidAmount: 0,
    balance: totalAmount,
    status: "UNPAID",

    remarks,
    createdBy: session?.user?.id,
    isVoided: false,
  });

  const saleItemsToInsert = [];
  const bodegaStockTransactions = [];

  for (const item of preparedItems) {
    const product = item.product;

    saleItemsToInsert.push({
      saleId: sale._id,

      productId: item.bodegaProductId,
      bodegaProductId: item.bodegaProductId,

      productName: item.productName,
      categoryName: item.categoryName,

      source,

      qty: item.qty,
      packs: item.packs,
      quantity: item.quantity,

      price: item.price,
      pricePerPack: item.pricePerPack,
      unitPrice: item.unitPrice,

      packSize: item.packSize,
      lineTotal: item.lineTotal,
    });

    product.stockQty = item.newStock;
    await product.save();

    bodegaStockTransactions.push({
      bodegaProductId: product._id,
      type: "STOCK_OUT",
      quantity: item.qty,
      previousStock: item.previousStock,
      newStock: item.newStock,
      remarks: `SALE ${receiptNumber}`,
      referenceType: "SALE",
      referenceId: sale._id,
      createdBy: session?.user?.id,
    });
  }

  // await SaleItemModel.insertMany(saleItemsToInsert);

  if (bodegaStockTransactions.length > 0) {
    await BodegaStockTransactionModel.insertMany(bodegaStockTransactions);
  }

  const populatedSale = await SaleModel.findById(sale._id)
    .populate("customerId", "name")
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
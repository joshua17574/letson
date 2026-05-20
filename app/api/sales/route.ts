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
import ProductModel from "@/models/Product";
import SaleModel from "@/models/Sale";
import SaleLineModel from "@/models/SaleLine";

type SaleSource = "BODEGA1" | "PRODUCT";

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
  remarks?: string;
};

function serializeSale(sale: any) {
  return {
    _id: sale._id.toString(),

    customerId:
      sale.customerId?._id?.toString?.() || sale.customerId?.toString?.(),
    customerName: sale.customerId?.name || "",

    source: sale.source || "BODEGA1",
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
    "NO CATEGORY"
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

  if (source === "BODEGA1" || source === "PRODUCT") {
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
  const source: SaleSource = sourceInput === "BODEGA1" ? "PRODUCT" : "BODEGA1";

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
    const bodegaProductId = cleanString(item.bodegaProductId || "");
    const productId = cleanString(item.productId || "");

    const qty = cleanNumber(item.quantity || item.packs || item.qty);
    const price = cleanNumber(item.pricePerPack || item.price || item.unitPrice);
    const packSize = cleanNumber(item.packSize) || 1;

    if (qty <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Quantity must be greater than zero.",
        },
        { status: 400 }
      );
    }

    if (price <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Price must be greater than zero.",
        },
        { status: 400 }
      );
    }

    let product: any = null;
    let productType: "BODEGA1" | "PRODUCT" = "BODEGA1";

    if (bodegaProductId && isValidObjectId(bodegaProductId)) {
      product = await BodegaProductModel.findOne({
        _id: bodegaProductId,
        isActive: true,
      }).populate("categoryId", "name");

      productType = "PRODUCT";
    } else if (productId && isValidObjectId(productId)) {
      product = await ProductModel.findOne({
        _id: productId,
        isActive: true,
      }).populate("categoryId", "name");

      productType = "PRODUCT";
    }

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          message: "Selected product was not found.",
        },
        { status: 404 }
      );
    }

    const categoryName = getCategoryName(product);
    const lineTotal = qty * price;

    let previousStock = 0;
    let newStock = 0;
    let stockPcsOut = qty;

    if (productType === "PRODUCT") {
      previousStock = Number(product.stockQty || 0);
      stockPcsOut = qty;

      if (previousStock < stockPcsOut) {
        return NextResponse.json(
          {
            success: false,
            message: `Not enough stock for ${product.name}. Available: ${previousStock}.`,
          },
          { status: 400 }
        );
      }

      newStock = previousStock - stockPcsOut;
    } else {
      previousStock = Number(product.stockPcs || 0);
      stockPcsOut = source === "BODEGA1" ? qty * packSize : qty;

      if (previousStock < stockPcsOut) {
        return NextResponse.json(
          {
            success: false,
            message: `Not enough stock for ${product.name}. Available: ${previousStock}.`,
          },
          { status: 400 }
        );
      }

      newStock = previousStock - stockPcsOut;
    }

    totalQty += qty;
    totalAmount += lineTotal;

    preparedItems.push({
      product,
      productType,

      productId: productType === "PRODUCT" ? product._id : undefined,
      bodegaProductId: productType === "PRODUCT" ? product._id : undefined,

      categoryId: product.categoryId?._id || product.categoryId || undefined,
      categoryName,
      productName: product.name,

      qty,
      price,
      lineTotal,

      stockUnit: source === "BODEGA1" ? "PACK" : "QTY",
      packSize: source === "BODEGA1" ? packSize : 0,
      stockPcsOut,

      previousStock,
      newStock,
      remarks: cleanString(item.remarks),
    });
  }

  const sale = await SaleModel.create({
    source,
    customerId,
    saleDate: new Date(saleDate),
    receiptNumber,

    totalPacks: source === "BODEGA1" ? totalQty : 0,
    totalQty,
    totalAmount,

    paidAmount: 0,
    balance: totalAmount,
    status: "UNPAID",

    remarks,
    createdBy: session?.user?.id,
    isVoided: false,
  });

  const saleLinesToInsert = [];
  const bodegaStockTransactions = [];

  for (const item of preparedItems) {
    saleLinesToInsert.push({
      saleId: sale._id,
      source,

      productId: item.productId,
      bodegaProductId: item.bodegaProductId,

      categoryId: item.categoryId,
      categoryName: item.categoryName,
      productName: item.productName,

      qty: item.qty,
      price: item.price,
      lineTotal: item.lineTotal,

      stockUnit: item.stockUnit,
      packSize: item.packSize,
      stockPcsOut: item.stockPcsOut,

      remarks: item.remarks,
    });

    if (item.productType === "PRODUCT") {
      item.product.stockQty = item.newStock;
      await item.product.save();

      bodegaStockTransactions.push({
        bodegaProductId: item.product._id,
        type: "STOCK_OUT",
        quantity: item.stockPcsOut,
        previousStock: item.previousStock,
        newStock: item.newStock,
        remarks: `SALE ${receiptNumber}`,
        referenceType: "SALE",
        referenceId: sale._id,
        createdBy: session?.user?.id,
      });
    }

    if (item.productType === "PRODUCT") {
      item.product.stockPcs = item.newStock;
      await item.product.save();
    }
  }

  await SaleLineModel.insertMany(saleLinesToInsert);

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
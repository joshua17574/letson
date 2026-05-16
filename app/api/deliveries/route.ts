// app/api/deliveries/route.ts
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
import DeliveryModel, { IDelivery } from "@/models/Delivery";
import DeliveryItemModel from "@/models/DeliveryItem";
import InventoryTransactionModel from "@/models/InventoryTransaction";
import ProductModel from "@/models/Product";
import SupplierModel from "@/models/Supplier";

type DeliveryItemInput = {
  productId: string;
  bags: number;
  kilos: number;
  pieces: number;
  buyingPrice: number;
};

function serializeDelivery(delivery: any) {
  return {
    _id: delivery._id.toString(),
    supplierId:
      delivery.supplierId?._id?.toString?.() || delivery.supplierId?.toString?.(),
    supplierName: delivery.supplierId?.name || "",
    deliveryCode: delivery.deliveryCode,
    receiptNumber: delivery.receiptNumber,
    totalBags: delivery.totalBags || 0,
    totalKilos: delivery.totalKilos || 0,
    totalPieces: delivery.totalPieces || 0,
    totalAmount: delivery.totalAmount || 0,
    deliveryDate: delivery.deliveryDate
      ? new Date(delivery.deliveryDate).toISOString()
      : undefined,
    remarks: delivery.remarks || "",
    createdAt: delivery.createdAt
      ? new Date(delivery.createdAt).toISOString()
      : undefined,
    updatedAt: delivery.updatedAt
      ? new Date(delivery.updatedAt).toISOString()
      : undefined,
  };
}

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const deliveryCode = cleanString(searchParams.get("deliveryCode"));
  const receiptNumber = cleanString(searchParams.get("receiptNumber"));
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

  const filter: QueryFilter<IDelivery> = {
    isVoided: false,
  };

  if (deliveryCode) {
    filter.deliveryCode = {
      $regex: escapeRegex(deliveryCode),
      $options: "i",
    };
  }

  if (receiptNumber) {
    filter.receiptNumber = {
      $regex: escapeRegex(receiptNumber),
      $options: "i",
    };
  }

  if (dateFrom || dateTo) {
    filter.deliveryDate = {};

    if (dateFrom) {
      filter.deliveryDate.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      filter.deliveryDate.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  const [items, total] = await Promise.all([
    DeliveryModel.find(filter)
      .populate("supplierId", "name")
      .sort({ deliveryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DeliveryModel.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: items.map(serializeDelivery),
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

  const supplierId = cleanString(body.supplierId);
  const deliveryCode = cleanString(body.deliveryCode);
  const receiptNumber = cleanString(body.receiptNumber);
  const deliveryDate = cleanString(body.deliveryDate);
  const remarks = cleanString(body.remarks);

  const items: DeliveryItemInput[] = Array.isArray(body.items)
    ? body.items
    : [];

  if (!supplierId || !isValidObjectId(supplierId)) {
    return NextResponse.json(
      {
        success: false,
        message: "Valid supplier is required.",
      },
      { status: 400 }
    );
  }

  if (!deliveryCode) {
    return NextResponse.json(
      {
        success: false,
        message: "Delivery code is required.",
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
        message: "At least one delivery item is required.",
      },
      { status: 400 }
    );
  }

  const supplierExists = await SupplierModel.exists({
    _id: supplierId,
    isActive: true,
  });

  if (!supplierExists) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier not found.",
      },
      { status: 404 }
    );
  }

  let totalBags = 0;
  let totalKilos = 0;
  let totalPieces = 0;
  let totalAmount = 0;

  const preparedItems = [];

  for (const item of items) {
    const productId = cleanString(item.productId);

    if (!productId || !isValidObjectId(productId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product in delivery item.",
        },
        { status: 400 }
      );
    }

    const product = await ProductModel.findOne({
      _id: productId,
      isActive: true,
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          message: "One of the selected products was not found.",
        },
        { status: 404 }
      );
    }

    const bags = cleanNumber(item.bags);
    const kilos = cleanNumber(item.kilos);
    const pieces = cleanNumber(item.pieces);
    const buyingPrice = cleanNumber(item.buyingPrice);

    if (bags <= 0 && kilos <= 0 && pieces <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Enter bags, kilos, or pieces for ${product.name}.`,
        },
        { status: 400 }
      );
    }

    const lineTotal = kilos > 0 ? kilos * buyingPrice : pieces * buyingPrice;

    totalBags += bags;
    totalKilos += kilos;
    totalPieces += pieces;
    totalAmount += lineTotal;

    preparedItems.push({
      product,
      productId: product._id,
      productName: product.name,
      bags,
      kilos,
      pieces,
      buyingPrice,
      lineTotal,
    });
  }

  const delivery = await DeliveryModel.create({
    supplierId,
    deliveryCode,
    receiptNumber,
    totalBags,
    totalKilos,
    totalPieces,
    totalAmount,
    deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
    remarks,
    createdBy: session?.user?.id,
  });

  const deliveryItemsToInsert = [];
  const inventoryTransactions = [];

  for (const item of preparedItems) {
    const product = item.product;

    deliveryItemsToInsert.push({
      deliveryId: delivery._id,
      productId: item.productId,
      productName: item.productName,
      bags: item.bags,
      kilos: item.kilos,
      pieces: item.pieces,
      buyingPrice: item.buyingPrice,
      lineTotal: item.lineTotal,
    });

    if (item.pieces > 0) {
      const previousStock = product.stockPcs;
      product.stockPcs += item.pieces;

      inventoryTransactions.push({
        productId: product._id,
        type: "DELIVERY",
        unit: "PCS",
        quantity: item.pieces,
        previousStock,
        newStock: product.stockPcs,
        remarks: `DELIVERY ${deliveryCode}`,
        referenceType: "DELIVERY",
        referenceId: delivery._id,
        createdBy: session?.user?.id,
      });
    }

    if (item.bags > 0) {
      const previousStock = product.stockBags;
      product.stockBags += item.bags;

      inventoryTransactions.push({
        productId: product._id,
        type: "DELIVERY",
        unit: "BAGS",
        quantity: item.bags,
        previousStock,
        newStock: product.stockBags,
        remarks: `DELIVERY ${deliveryCode}`,
        referenceType: "DELIVERY",
        referenceId: delivery._id,
        createdBy: session?.user?.id,
      });
    }

    if (item.kilos > 0) {
      const previousStock = product.stockKilos;
      product.stockKilos += item.kilos;

      inventoryTransactions.push({
        productId: product._id,
        type: "DELIVERY",
        unit: "KILOS",
        quantity: item.kilos,
        previousStock,
        newStock: product.stockKilos,
        remarks: `DELIVERY ${deliveryCode}`,
        referenceType: "DELIVERY",
        referenceId: delivery._id,
        createdBy: session?.user?.id,
      });
    }

    await product.save();
  }

  await DeliveryItemModel.insertMany(deliveryItemsToInsert);

  if (inventoryTransactions.length > 0) {
    await InventoryTransactionModel.insertMany(inventoryTransactions);
  }

  const populatedDelivery = await DeliveryModel.findById(delivery._id)
    .populate("supplierId", "name")
    .lean();

  return NextResponse.json(
    {
      success: true,
      message: "Delivery created successfully.",
      data: serializeDelivery(populatedDelivery),
    },
    { status: 201 }
  );
}
// app/api/deliveries/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanNumber, cleanString } from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";
import DeliveryModel from "@/models/Delivery";
import DeliveryItemModel from "@/models/DeliveryItem";
import SupplierModel from "@/models/Supplier";

type DeliveryItemInput = {
  categoryId?: string;
  bodegaProductId?: string;
  productId?: string;
  bags: number;
  kilos: number;
  pieces: number;
  buyingPrice: number;
};

function getStockQty(item: {
  bags: number;
  kilos: number;
  pieces: number;
}) {
  if (item.pieces > 0) return item.pieces;
  if (item.kilos > 0) return item.kilos;
  if (item.bags > 0) return item.bags;

  return 0;
}

function getLineTotal(item: {
  kilos: number;
  pieces: number;
  buyingPrice: number;
}) {
  if (item.kilos > 0) return item.kilos * item.buyingPrice;
  return item.pieces * item.buyingPrice;
}

function serializeDelivery(delivery: any, lines: any[] = []) {
  return {
    _id: delivery._id.toString(),

    supplierId:
      delivery.supplierId?._id?.toString?.() ||
      delivery.supplierId?.toString?.(),
    supplierName: delivery.supplierId?.name || "",

    deliveryCode: delivery.deliveryCode,
    receiptNumber: delivery.receiptNumber,

    totalBags: Number(delivery.totalBags || 0),
    totalKilos: Number(delivery.totalKilos || 0),
    totalPieces: Number(delivery.totalPieces || 0),
    totalAmount: Number(delivery.totalAmount || 0),

    deliveryDate: delivery.deliveryDate
      ? new Date(delivery.deliveryDate).toISOString()
      : undefined,

    remarks: delivery.remarks || "",

    items: lines.map((line) => ({
      _id: line._id?.toString?.() || "",
      deliveryId: line.deliveryId?.toString?.() || "",

      productId:
        line.productId?._id?.toString?.() ||
        line.productId?.toString?.() ||
        line.bodegaProductId?.toString?.() ||
        "",

      bodegaProductId:
        line.bodegaProductId?.toString?.() ||
        line.productId?.toString?.() ||
        "",

      categoryId: line.categoryId?.toString?.() || "",

      productName:
        line.productName ||
        line.bodegaProductName ||
        line.productId?.name ||
        "",

      bags: Number(line.bags || 0),
      kilos: Number(line.kilos || 0),
      pieces: Number(line.pieces || 0),
      buyingPrice: Number(line.buyingPrice || 0),
      lineTotal: Number(line.lineTotal || line.totalAmount || 0),
      totalAmount: Number(line.lineTotal || line.totalAmount || 0),
    })),
  };
}

async function reverseDeliveryStock({
  deliveryId,
  deliveryCode,
  createdBy,
}: {
  deliveryId: string;
  deliveryCode: string;
  createdBy?: string;
}) {
  const oldItems = await DeliveryItemModel.find({
    deliveryId,
  });

  const transactions = [];

  for (const item of oldItems) {
    const bodegaProductId = cleanString(
      String((item as any).bodegaProductId || (item as any).productId || "")
    );

    if (!bodegaProductId || !isValidObjectId(bodegaProductId)) continue;

    const product = await BodegaProductModel.findOne({
      _id: bodegaProductId,
      isActive: true,
    });

    if (!product) continue;

    const stockQtyToReverse = getStockQty({
      bags: Number((item as any).bags || 0),
      kilos: Number((item as any).kilos || 0),
      pieces: Number((item as any).pieces || 0),
    });

    if (stockQtyToReverse <= 0) continue;

    const previousStock = Number(product.stockQty || 0);
    product.stockQty = Math.max(previousStock - stockQtyToReverse, 0);

    await product.save();

    transactions.push({
      bodegaProductId: product._id,
      type: "VOID_REVERSAL",
      quantity: stockQtyToReverse,
      previousStock,
      newStock: product.stockQty,
      remarks: `VOID DELIVERY ${deliveryCode}`,
      referenceType: "DELIVERY_VOID",
      referenceId: deliveryId,
      createdBy,
    });
  }

  if (transactions.length > 0) {
    await BodegaStockTransactionModel.insertMany(transactions);
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid delivery ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const delivery = await DeliveryModel.findOne({
    _id: id,
    isVoided: false,
  })
    .populate("supplierId", "name")
    .lean();

  if (!delivery) {
    return NextResponse.json(
      {
        success: false,
        message: "Delivery not found.",
      },
      { status: 404 }
    );
  }

  const lines = await DeliveryItemModel.find({
    deliveryId: id,
  }).lean();

  return NextResponse.json({
    success: true,
    data: serializeDelivery(delivery, lines),
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid delivery ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const delivery = await DeliveryModel.findOne({
    _id: id,
    isVoided: false,
  });

  if (!delivery) {
    return NextResponse.json(
      {
        success: false,
        message: "Delivery not found.",
      },
      { status: 404 }
    );
  }

  const body = await req.json();

  const supplierId = cleanString(body.supplierId);
  const deliveryCode = cleanString(body.deliveryCode);
  const receiptNumber = cleanString(body.receiptNumber);
  const deliveryDate = cleanString(body.deliveryDate);
  const remarks = cleanString(body.remarks);

  const items: DeliveryItemInput[] = Array.isArray(body.items)
    ? body.items
    : Array.isArray(body.deliveryItems)
      ? body.deliveryItems
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
    const bodegaProductId = cleanString(
      item.bodegaProductId || item.productId || ""
    );

    const categoryId = cleanString(item.categoryId || "");

    if (!bodegaProductId || !isValidObjectId(bodegaProductId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid bodega product in delivery item.",
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
          message: "One of the selected bodega products was not found.",
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

    const lineTotal = getLineTotal({
      kilos,
      pieces,
      buyingPrice,
    });

    const stockQtyToAdd = getStockQty({
      bags,
      kilos,
      pieces,
    });

    totalBags += bags;
    totalKilos += kilos;
    totalPieces += pieces;
    totalAmount += lineTotal;

    preparedItems.push({
      product,
      categoryId,
      bodegaProductId: product._id,
      productName: product.name,
      bags,
      kilos,
      pieces,
      buyingPrice,
      lineTotal,
      stockQtyToAdd,
    });
  }

  await reverseDeliveryStock({
    deliveryId: id,
    deliveryCode: delivery.deliveryCode,
    createdBy: session?.user?.id,
  });

  await DeliveryItemModel.deleteMany({
    deliveryId: id,
  });

  delivery.supplierId = supplierId as any;
  delivery.deliveryCode = deliveryCode;
  delivery.receiptNumber = receiptNumber;
  delivery.totalBags = totalBags;
  delivery.totalKilos = totalKilos;
  delivery.totalPieces = totalPieces;
  delivery.totalAmount = totalAmount;
  delivery.deliveryDate = deliveryDate ? new Date(deliveryDate) : new Date();
  delivery.remarks = remarks;

  await delivery.save();

  const deliveryItemsToInsert = [];
  const bodegaStockTransactions = [];

  for (const item of preparedItems) {
    const product = item.product;

    deliveryItemsToInsert.push({
      deliveryId: delivery._id,

      productId: item.bodegaProductId,
      bodegaProductId: item.bodegaProductId,
      categoryId: item.categoryId,

      productName: item.productName,
      bags: item.bags,
      kilos: item.kilos,
      pieces: item.pieces,
      buyingPrice: item.buyingPrice,
      lineTotal: item.lineTotal,
    });

    const previousStock = Number(product.stockQty || 0);
    product.stockQty = previousStock + item.stockQtyToAdd;
    product.buyingPrice = item.buyingPrice;

    await product.save();

    bodegaStockTransactions.push({
      bodegaProductId: product._id,
      type: "STOCK_IN",
      quantity: item.stockQtyToAdd,
      previousStock,
      newStock: product.stockQty,
      remarks: `EDIT DELIVERY ${deliveryCode}`,
      referenceType: "DELIVERY",
      referenceId: delivery._id,
      createdBy: session?.user?.id,
    });
  }

  await DeliveryItemModel.insertMany(deliveryItemsToInsert);

  if (bodegaStockTransactions.length > 0) {
    await BodegaStockTransactionModel.insertMany(bodegaStockTransactions);
  }

  const populatedDelivery = await DeliveryModel.findById(delivery._id)
    .populate("supplierId", "name")
    .lean();

  const lines = await DeliveryItemModel.find({
    deliveryId: delivery._id,
  }).lean();

  return NextResponse.json({
    success: true,
    message: "Delivery updated successfully.",
    data: serializeDelivery(populatedDelivery, lines),
  });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requireApiAuth();

  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid delivery ID.",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const delivery = await DeliveryModel.findOne({
    _id: id,
    isVoided: false,
  });

  if (!delivery) {
    return NextResponse.json(
      {
        success: false,
        message: "Delivery not found.",
      },
      { status: 404 }
    );
  }

  await reverseDeliveryStock({
    deliveryId: id,
    deliveryCode: delivery.deliveryCode,
    createdBy: session?.user?.id,
  });

  delivery.isVoided = true;
  await delivery.save();

  return NextResponse.json({
    success: true,
    message: "Delivery voided successfully and bodega stock was reversed.",
  });
}
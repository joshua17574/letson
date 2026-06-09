import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { cleanString, escapeRegex, getPagination } from "@/lib/crud-utils";
import { idToString, numberValue } from "@/lib/customer-delivery-utils";
import CustomerInventoryModel from "@/models/CustomerInventory";

function getPackBreakdown(stockQtyValue: unknown, packSizeValue: unknown) {
  const stockQty = Math.max(0, Math.trunc(numberValue(stockQtyValue)));
  const packSize = Math.max(0, Math.trunc(numberValue(packSizeValue)));

  if (packSize <= 0) {
    return {
      packs: 0,
      loosePcs: stockQty,
      stockQty,
      packSize: 0,
      isPackProduct: false,
    };
  }

  const packs = Math.floor(stockQty / packSize);
  const loosePcs = stockQty - packs * packSize;

  return {
    packs,
    loosePcs,
    stockQty,
    packSize,
    isPackProduct: true,
  };
}

function serializeInventory(item: any) {
  const breakdown = getPackBreakdown(item?.stockQty, item?.packSize);

  return {
    _id: idToString(item?._id),
    customerId: idToString(item?.customerId?._id || item?.customerId),
    customerName: item?.customerId?.name || "",
    source: item?.source || "GROCERY",
    productId: idToString(item?.productId),
    bodegaProductId: idToString(item?.bodegaProductId),
    categoryName: item?.categoryName || "",
    productName: item?.productName || "",
    stockQty: numberValue(item?.stockQty),
    stockUnit: item?.stockUnit || "QTY",
    packSize: breakdown.packSize,
    stockPacks: breakdown.packs,
    stockLoosePcs: breakdown.loosePcs,
    isPackProduct: breakdown.isPackProduct,
    lastDeliveryAt: item?.lastDeliveryAt ? new Date(item.lastDeliveryAt).toISOString() : undefined,
    updatedAt: item?.updatedAt ? new Date(item.updatedAt).toISOString() : undefined,
  };
}

export async function GET(req: NextRequest) {
  const { response } = await requirePermission("customer-deliveries.view");
  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);
  const customerId = cleanString(searchParams.get("customerId"));
  const source = cleanString(searchParams.get("source")).toUpperCase();
  const search = cleanString(searchParams.get("search"));

  const filter: Record<string, any> = {
    isActive: true,
  };

  if (customerId && isValidObjectId(customerId)) {
    filter.customerId = customerId;
  }

  if (source === "BODEGA" || source === "GROCERY") {
    filter.source = source;
  }

  if (search) {
    filter.productName = {
      $regex: escapeRegex(search),
      $options: "i",
    };
  }

  const [items, total] = await Promise.all([
    CustomerInventoryModel.find(filter)
      .populate("customerId", "name phone address type")
      .sort({ updatedAt: -1, productName: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CustomerInventoryModel.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: items.map(serializeInventory),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}

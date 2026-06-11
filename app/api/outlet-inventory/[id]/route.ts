import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { cleanNumber, cleanString } from "@/lib/crud-utils";
import OutletInventoryModel, { OutletInventoryUnit } from "@/models/OutletInventory";
import OutletStockTransactionModel from "@/models/OutletStockTransaction";
import AuditLogModel from "@/models/AuditLog";

const unitLabels: OutletInventoryUnit[] = ["PCS", "PACK", "QTY", "KG", "BAG"];

function isUnitLabel(value: string): value is OutletInventoryUnit {
  return unitLabels.includes(value as OutletInventoryUnit);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function idToString(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value) return String(value.toString());
  return "";
}

function getPackBreakdown(quantityValue: unknown, packSizeValue: unknown) {
  const quantity = Math.max(0, Math.trunc(numberValue(quantityValue)));
  const packSize = Math.max(0, Math.trunc(numberValue(packSizeValue)));

  if (packSize <= 0) {
    return {
      totalPcs: quantity,
      packs: 0,
      loosePcs: quantity,
    };
  }

  const packs = Math.floor(quantity / packSize);
  const loosePcs = quantity - packs * packSize;

  return {
    totalPcs: quantity,
    packs,
    loosePcs,
  };
}

function serializeOutletInventory(item: any) {
  const packSize = Math.max(0, Math.trunc(numberValue(item.packSize)));
  const stockBreakdown = getPackBreakdown(item.stockQty, packSize);

  return {
    _id: idToString(item._id),
    outletId: idToString(item.outletId),
    productSource: item.productSource || "GROCERY",
    productId: idToString(item.productId),
    productName: item.productName || "",
    categoryName: item.categoryName || "",
    stockQty: numberValue(item.stockQty),
    unitLabel: item.unitLabel || "QTY",
    packSize,
    stockPacks: stockBreakdown.packs,
    stockLoosePcs: stockBreakdown.loosePcs,
    lowStockAlert: numberValue(item.lowStockAlert),
    buyingPrice: numberValue(item.buyingPrice),
    sellingPrice: numberValue(item.sellingPrice),
    remarks: item.remarks || "",
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : undefined,
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : undefined,
  };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requirePermission("outlet-inventory.manage");
  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid outlet inventory ID." },
      { status: 400 }
    );
  }

  await dbConnect();

  const inventory = await OutletInventoryModel.findOne({ _id: id, isActive: true });

  if (!inventory) {
    return NextResponse.json(
      { success: false, message: "Outlet inventory item not found." },
      { status: 404 }
    );
  }

  const body = await req.json();
  const oldValue = inventory.toObject();
  const previousStock = numberValue(inventory.stockQty);
  const nextStock = cleanNumber(body.stockQty, previousStock);
  const unitInput = cleanString(body.unitLabel).toUpperCase();
  const lowStockAlert = cleanNumber(body.lowStockAlert);
  const remarks = cleanString(body.remarks);

  inventory.stockQty = nextStock;
  inventory.unitLabel = isUnitLabel(unitInput) ? unitInput : inventory.unitLabel;
  inventory.lowStockAlert = lowStockAlert;
  inventory.remarks = remarks;
  inventory.updatedBy = session?.user?.id as any;
  await inventory.save();

  if (nextStock !== previousStock) {
    await OutletStockTransactionModel.create({
      outletId: inventory.outletId,
      outletInventoryId: inventory._id,
      productSource: inventory.productSource,
      productId: inventory.productId,
      productName: inventory.productName,
      transactionDate: new Date(),
      type: "ADJUSTMENT",
      quantity: Math.abs(nextStock - previousStock),
      previousStock,
      newStock: nextStock,
      referenceType: "MANUAL_ADJUSTMENT",
      sourceChannel: "WEB",
      remarks: remarks || "MANUAL OUTLET INVENTORY ADJUSTMENT",
      createdBy: session?.user?.id,
    });
  }

  await AuditLogModel.create({
    outletId: inventory.outletId,
    module: "OUTLET INVENTORY",
    action: "UPDATE",
    entityType: "OUTLET_INVENTORY",
    entityId: inventory._id,
    oldValue,
    newValue: inventory.toObject(),
    sourceChannel: "WEB",
    createdBy: session?.user?.id,
  });

  return NextResponse.json({
    success: true,
    message: "Outlet inventory updated successfully.",
    data: serializeOutletInventory(inventory.toObject()),
  });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requirePermission("outlet-inventory.manage");
  if (response) return response;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid outlet inventory ID." },
      { status: 400 }
    );
  }

  await dbConnect();

  const inventory = await OutletInventoryModel.findOne({ _id: id, isActive: true });

  if (!inventory) {
    return NextResponse.json(
      { success: false, message: "Outlet inventory item not found." },
      { status: 404 }
    );
  }

  if (numberValue(inventory.stockQty) > 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Cannot delete outlet inventory item with remaining stock.",
      },
      { status: 409 }
    );
  }

  const oldValue = inventory.toObject();
  inventory.isActive = false;
  inventory.updatedBy = session?.user?.id as any;
  await inventory.save();

  await AuditLogModel.create({
    outletId: inventory.outletId,
    module: "OUTLET INVENTORY",
    action: "DELETE",
    entityType: "OUTLET_INVENTORY",
    entityId: inventory._id,
    oldValue,
    sourceChannel: "WEB",
    createdBy: session?.user?.id,
  });

  return NextResponse.json({
    success: true,
    message: "Outlet inventory item deleted successfully.",
  });
}

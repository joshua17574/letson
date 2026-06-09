import { isValidObjectId, Types } from "mongoose";

export type CustomerDeliveryItemSource = "BODEGA" | "GROCERY";

export function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function positiveNumber(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

export function wholeNumber(value: unknown) {
  return Math.max(0, Math.trunc(numberValue(value)));
}

export function cleanDeliveryCategory(value: unknown): "DELIVER" | "PICKUP" {
  const text = String(value || "").trim().toUpperCase();
  return text === "PICKUP" ? "PICKUP" : "DELIVER";
}

export function cleanDeliveryStatus(value: unknown) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "PENDING" || text === "CONFIRMED" || text === "CANCELLED") {
    return text;
  }
  return "";
}

export function cleanItemSource(value: unknown): CustomerDeliveryItemSource {
  const text = String(value || "").trim().toUpperCase();
  return text === "GROCERY" || text === "PRODUCT" ? "GROCERY" : "BODEGA";
}

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function idToString(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "object" && "toString" in value) return String(value.toString());
  return "";
}

export function makeObjectId(value: string) {
  return isValidObjectId(value) ? new Types.ObjectId(value) : null;
}

export function getCategoryName(product: any) {
  return (
    product?.categoryName ||
    product?.categoryId?.name ||
    product?.category?.name ||
    "NO CATEGORY"
  );
}

export function getCategoryId(product: any) {
  return product?.categoryId?._id || product?.categoryId || undefined;
}

export function serializeCustomerDelivery(delivery: any) {
  return {
    _id: idToString(delivery?._id),
    deliveryCode: delivery?.deliveryCode || "",
    customerId: idToString(delivery?.customerId?._id || delivery?.customerId),
    customerName: delivery?.customerId?.name || "",
    customerPhone: delivery?.customerId?.phone || "",
    customerAddress: delivery?.customerId?.address || "",
    category: delivery?.category || "DELIVER",
    status: delivery?.status || "PENDING",
    requestDate: delivery?.requestDate ? new Date(delivery.requestDate).toISOString() : undefined,
    scheduledDate: delivery?.scheduledDate ? new Date(delivery.scheduledDate).toISOString() : undefined,
    confirmedAt: delivery?.confirmedAt ? new Date(delivery.confirmedAt).toISOString() : undefined,
    cancelledAt: delivery?.cancelledAt ? new Date(delivery.cancelledAt).toISOString() : undefined,
    totalItems: numberValue(delivery?.totalItems),
    totalQty: numberValue(delivery?.totalQty),
    totalAmount: numberValue(delivery?.totalAmount),
    remarks: delivery?.remarks || "",
    createdAt: delivery?.createdAt ? new Date(delivery.createdAt).toISOString() : undefined,
    updatedAt: delivery?.updatedAt ? new Date(delivery.updatedAt).toISOString() : undefined,
  };
}

export function serializeCustomerDeliveryItem(item: any) {
  return {
    _id: idToString(item?._id),
    customerDeliveryId: idToString(item?.customerDeliveryId),
    source: item?.source || "BODEGA",
    productId: idToString(item?.productId),
    bodegaProductId: idToString(item?.bodegaProductId),
    categoryName: item?.categoryName || "",
    productName: item?.productName || "",
    qty: numberValue(item?.qty),
    price: numberValue(item?.price),
    lineTotal: numberValue(item?.lineTotal),
    stockUnit: item?.stockUnit || "QTY",
    packSize: numberValue(item?.packSize),
    stockPcsOut: numberValue(item?.stockPcsOut),
    remarks: item?.remarks || "",
  };
}

export type MobileInventorySource = "BODEGA" | "GROCERY";
export type MobileSaleLineSource = "CHICKEN" | "BODEGA";
export type MobileSaleSource = MobileSaleLineSource | "MIXED";

type IdLike = string | { toString(): string };

export type MobileInventoryRecord = {
  _id: IdLike;
  productId?: unknown;
  productName?: unknown;
  categoryName?: unknown;
  productSource?: unknown;
  stockQty?: unknown;
  unitLabel?: unknown;
  packSize?: unknown;
  lowStockAlert?: unknown;
  buyingPrice?: unknown;
  sellingPrice?: unknown;
  sellingPriceOverride?: unknown;
};

export type CatalogPriceRecord = {
  buyingPrice?: unknown;
  sellingPrice?: unknown;
  unitPrice?: unknown;
} | null;

export type ParsedMobileCartLine =
  | { kind: "menu"; itemId: string; qty: number }
  | { kind: "inventory"; itemId: string; qty: number };

export type MobileCartLineParseResult =
  { ok: true; line: ParsedMobileCartLine } | { ok: false; message: string };

export type MobileInventoryDeductionRequest = {
  items: Array<{ inventoryId: string; qty: number }>;
  remarks: string;
};

export type MobileInventoryDeductionParseResult =
  | { ok: true; value: MobileInventoryDeductionRequest }
  | { ok: false; message: string };

export type MobileCustomerStockTransferRequest = {
  customerName: string;
  items: Array<{ inventoryId: string; qty: number }>;
};

export type MobileCustomerStockTransferParseResult =
  | { ok: true; value: MobileCustomerStockTransferRequest }
  | { ok: false; message: string };

export type MobilePriceUpdateParseResult =
  { ok: true; value: { sell: number } } | { ok: false; message: string };

export type MobileSaleVoidParseResult =
  | { ok: true; value: { reason: string; refunded?: number } }
  | { ok: false; message: string };

export type MobileDeductionHistoryQueryResult =
  | {
      ok: true;
      value: {
        from?: Date;
        toExclusive?: Date;
        page: number;
        pageSize: number;
      };
    }
  | { ok: false; message: string };

export type MobileSaleTenderResult =
  | { ok: true; cashReceived: number; change: number }
  | { ok: false; message: string };

export type MobileInventoryCategory = "CHICKEN" | "DRINKS" | "INGREDIENTS";

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeMoney(value: unknown): number {
  return Math.max(0, finiteNumber(value) ?? 0);
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function normalizeMobileInventoryCategory(
  value: unknown,
): MobileInventoryCategory | null {
  const category = String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
  if (category === "CHICKEN") return "CHICKEN";
  if (
    category === "DRINK" ||
    category === "DRINKS" ||
    category === "BEVERAGE" ||
    category === "BEVERAGES"
  ) {
    return "DRINKS";
  }
  if (category === "INGREDIENT" || category === "INGREDIENTS") {
    return "INGREDIENTS";
  }
  return null;
}

export function mobileExpenseOutletPattern(outletId: string): RegExp {
  const escapedOutletId = outletId.replace(/[\^$.*+?()[\]{}|]/g, "\\$&");
  return new RegExp(
    String.raw`MOBILE EXPENSE OUTLET:${escapedOutletId}(?:\s|$)`,
  );
}

export function mobileExpenseDeleteFilter(outletId: string, expenseId: string) {
  return {
    _id: expenseId,
    isActive: true,
    remarks: { $regex: mobileExpenseOutletPattern(outletId) },
  };
}

export function parseMobileDeductionHistoryQuery(input: {
  from?: unknown;
  to?: unknown;
  page?: unknown;
  pageSize?: unknown;
}): MobileDeductionHistoryQueryResult {
  const parsePageValue = (
    value: unknown,
    fallback: number,
    maximum: number,
  ) => {
    if (value == null) return fallback;
    const parsed = finiteNumber(value);
    return parsed != null &&
      Number.isInteger(parsed) &&
      parsed > 0 &&
      parsed <= maximum
      ? parsed
      : null;
  };
  const parseManilaDay = (value: unknown, exclusiveEnd: boolean) => {
    if (value == null || value === "") return undefined;
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const utcDay = new Date(Date.UTC(year, month - 1, day));
    if (
      utcDay.getUTCFullYear() !== year ||
      utcDay.getUTCMonth() !== month - 1 ||
      utcDay.getUTCDate() !== day
    ) {
      return null;
    }
    const nextDay = exclusiveEnd ? 1 : 0;
    return new Date(
      Date.UTC(year, month - 1, day + nextDay) - 8 * 60 * 60 * 1000,
    );
  };

  const page = parsePageValue(input.page, 1, 1_000_000);
  const pageSize = parsePageValue(input.pageSize, 20, 50);
  const from = parseManilaDay(input.from, false);
  const toExclusive = parseManilaDay(input.to, true);
  if (page == null || pageSize == null) {
    return { ok: false, message: "Invalid deduction history page." };
  }
  if (from === null || toExclusive === null) {
    return { ok: false, message: "Invalid deduction history date." };
  }
  if (from != null && toExclusive != null && from >= toExclusive) {
    return {
      ok: false,
      message: "The start date must be on or before the end date.",
    };
  }
  return { ok: true, value: { from, toExclusive, page, pageSize } };
}

export function parseMobilePriceUpdateRequest(
  value: unknown,
): MobilePriceUpdateParseResult {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Invalid request body." };
  }
  const sell = finiteNumber((value as Record<string, unknown>).sell);
  if (
    sell == null ||
    !Number.isInteger(sell) ||
    sell <= 0 ||
    sell > 1_000_000
  ) {
    return {
      ok: false,
      message: "Selling price must be a whole-peso amount greater than zero.",
    };
  }
  return { ok: true, value: { sell } };
}

export function parseMobileSaleVoidRequest(
  value: unknown,
): MobileSaleVoidParseResult {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Invalid request body." };
  }

  const input = value as Record<string, unknown>;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length > 200) {
    return { ok: false, message: "Void reason must be 200 characters or fewer." };
  }

  const refunded =
    input.refunded == null ? undefined : finiteNumber(input.refunded);
  if (refunded === null || (refunded != null && (refunded < 0 || refunded > 1_000_000))) {
    return { ok: false, message: "Refunded amount must be a valid non-negative amount." };
  }

  return {
    ok: true,
    value: { reason, refunded: refunded == null ? undefined : roundMoney(refunded) },
  };
}

export function parseMobileSaleReference(
  value: unknown,
  kind: "OUTLET_INVENTORY" | "MENU",
): string | undefined {
  const match = new RegExp(`^${kind}:([a-f0-9]{24})$`, "i").exec(
    String(value || ""),
  );
  return match?.[1].toLowerCase();
}

export function parseMobileInventoryDeductionRequest(
  value: unknown,
): MobileInventoryDeductionParseResult {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Invalid request body." };
  }

  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, message: "At least one ingredient is required." };
  }
  if (input.items.length > 100) {
    return {
      ok: false,
      message: "A deduction can contain at most 100 ingredients.",
    };
  }

  const items: MobileInventoryDeductionRequest["items"] = [];
  const inventoryIds = new Set<string>();
  for (const rawItem of input.items) {
    if (
      rawItem == null ||
      typeof rawItem !== "object" ||
      Array.isArray(rawItem)
    ) {
      return {
        ok: false,
        message:
          "Each deduction needs an inventory ID and a whole-piece quantity.",
      };
    }

    const item = rawItem as Record<string, unknown>;
    const inventoryId =
      typeof item.inventoryId === "string" ? item.inventoryId.trim() : "";
    const qty = finiteNumber(item.qty);
    if (!inventoryId || qty == null || !Number.isInteger(qty) || qty <= 0) {
      return {
        ok: false,
        message:
          "Each deduction needs an inventory ID and a whole-piece quantity.",
      };
    }
    if (inventoryIds.has(inventoryId)) {
      return {
        ok: false,
        message: "Each ingredient may only appear once per deduction.",
      };
    }
    inventoryIds.add(inventoryId);
    items.push({ inventoryId, qty });
  }

  const remarks = typeof input.remarks === "string" ? input.remarks.trim() : "";
  if (remarks.length > 500) {
    return { ok: false, message: "Remarks must be 500 characters or fewer." };
  }

  return { ok: true, value: { items, remarks } };
}

export function parseMobileCustomerStockTransferRequest(
  value: unknown,
): MobileCustomerStockTransferParseResult {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Invalid request body." };
  }

  const input = value as Record<string, unknown>;
  const customerName =
    typeof input.customerName === "string" ? input.customerName.trim() : "";
  if (!customerName) {
    return { ok: false, message: "Customer name is required." };
  }
  if (customerName.length > 120) {
    return {
      ok: false,
      message: "Customer name must be 120 characters or fewer.",
    };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, message: "At least one stock item is required." };
  }
  if (input.items.length > 50) {
    return {
      ok: false,
      message: "A customer transfer can contain at most 50 items.",
    };
  }

  const items: MobileCustomerStockTransferRequest["items"] = [];
  const inventoryIds = new Set<string>();
  for (const rawItem of input.items) {
    if (
      rawItem == null ||
      typeof rawItem !== "object" ||
      Array.isArray(rawItem)
    ) {
      return {
        ok: false,
        message:
          "Each transfer item needs an inventory ID and a whole-piece quantity.",
      };
    }
    const item = rawItem as Record<string, unknown>;
    const inventoryId =
      typeof item.inventoryId === "string" ? item.inventoryId.trim() : "";
    const qty = finiteNumber(item.qty);
    if (!inventoryId || qty == null || !Number.isInteger(qty) || qty <= 0) {
      return {
        ok: false,
        message:
          "Each transfer item needs an inventory ID and a whole-piece quantity.",
      };
    }
    if (inventoryIds.has(inventoryId)) {
      return {
        ok: false,
        message: "Each inventory item may only appear once per transfer.",
      };
    }
    inventoryIds.add(inventoryId);
    items.push({ inventoryId, qty });
  }

  return { ok: true, value: { customerName, items } };
}

export function pricePerPiece(price: unknown, packSize: unknown): number {
  const amount = nonNegativeMoney(price);
  const size = Math.max(0, Math.trunc(finiteNumber(packSize) ?? 0));
  return Math.round(amount / (size > 0 ? size : 1));
}

export function serializeMobileInventoryItem(
  item: MobileInventoryRecord,
  catalogProduct: CatalogPriceRecord = null,
) {
  const source =
    String(item.productSource || "").toUpperCase() === "GROCERY"
      ? "GROCERY"
      : "BODEGA";
  const catalogBuyingPrice = finiteNumber(catalogProduct?.buyingPrice);
  const catalogSellingPrice = finiteNumber(
    source === "GROCERY"
      ? catalogProduct?.unitPrice
      : catalogProduct?.sellingPrice,
  );
  const sellingPriceOverride = finiteNumber(item.sellingPriceOverride);
  const buyingPrice = nonNegativeMoney(catalogBuyingPrice ?? item.buyingPrice);
  const sellingPrice = nonNegativeMoney(
    sellingPriceOverride ?? catalogSellingPrice ?? item.sellingPrice,
  );
  const packSize = Math.max(0, Math.trunc(finiteNumber(item.packSize) ?? 0));
  const pricePackSize = source === "BODEGA" ? packSize : 0;

  return {
    id: String(item._id),
    productName: String(item.productName || ""),
    categoryName: String(item.categoryName || ""),
    productSource: source as MobileInventorySource,
    stockQty: finiteNumber(item.stockQty) ?? 0,
    unitLabel: String(item.unitLabel || "QTY"),
    packSize,
    lowStockAlert: Math.max(
      0,
      Math.trunc(finiteNumber(item.lowStockAlert) ?? 0),
    ),
    buyingPrice,
    sellingPrice,
    sellingPriceOverride,
    pieceBuyingPrice: pricePerPiece(buyingPrice, pricePackSize),
    pieceSellingPrice: pricePerPiece(sellingPrice, pricePackSize),
  };
}

export function prepareDirectInventorySaleLine(
  item: MobileInventoryRecord,
  catalogProduct: CatalogPriceRecord,
  qty: number,
) {
  const productName = String(item.productName || "Inventory item");
  if (!isDirectSellCategory(item.categoryName)) {
    return {
      ok: false as const,
      message: `${productName} is not available for direct sale.`,
    };
  }
  if (catalogProduct == null) {
    return {
      ok: false as const,
      message: `${productName} is no longer available in the product catalog.`,
    };
  }

  const inventory = serializeMobileInventoryItem(item, catalogProduct);
  const productId = String(item.productId || "").trim();
  if (!productId) {
    return {
      ok: false as const,
      message: `${productName} has no valid product reference.`,
    };
  }
  if (inventory.pieceSellingPrice <= 0) {
    return {
      ok: false as const,
      message: `${productName} has no selling price.`,
    };
  }

  const source: MobileSaleLineSource =
    inventory.productSource === "BODEGA" ? "CHICKEN" : "BODEGA";
  return {
    ok: true as const,
    line: {
      source,
      productName,
      categoryName: inventory.categoryName,
      qty,
      price: inventory.pieceSellingPrice,
      lineTotal: roundMoney(qty * inventory.pieceSellingPrice),
      stockUnit: "QTY" as const,
      packSize: 1,
      stockPcsOut: qty,
      ...(source === "CHICKEN"
        ? { bodegaProductId: productId }
        : { productId }),
      remarks: `OUTLET_INVENTORY:${String(item._id)}`,
    },
    deduction: {
      inventoryId: String(item._id),
      source: inventory.productSource,
      productId,
      qty,
      name: productName,
      strict: true as const,
    },
  };
}

export function parseMobileCartLine(value: unknown): MobileCartLineParseResult {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Invalid cart item." };
  }

  const input = value as Record<string, unknown>;
  const menuItemId =
    typeof input.menuItemId === "string" ? input.menuItemId.trim() : "";
  const inventoryItemId =
    typeof input.inventoryItemId === "string"
      ? input.inventoryItemId.trim()
      : "";

  if ((menuItemId ? 1 : 0) + (inventoryItemId ? 1 : 0) !== 1) {
    return {
      ok: false,
      message:
        "Each cart item must provide exactly one of menuItemId or inventoryItemId.",
    };
  }

  const rawQty = finiteNumber(input.qty);
  const qty = Math.trunc(rawQty ?? 0);
  if (rawQty == null || qty < 1) {
    return { ok: false, message: "Cart item quantity must be at least 1." };
  }

  return {
    ok: true,
    line: menuItemId
      ? { kind: "menu", itemId: menuItemId, qty }
      : { kind: "inventory", itemId: inventoryItemId, qty },
  };
}

export function validateMobileSaleTender(
  cashReceived: unknown,
  totalAmount: unknown,
  requiresVerifiedTender: boolean,
): MobileSaleTenderResult {
  const total = roundMoney(nonNegativeMoney(totalAmount));
  const cash = finiteNumber(cashReceived);

  if (requiresVerifiedTender) {
    if (cash == null) {
      return {
        ok: false,
        message: "Cash received is required for inventory sales.",
      };
    }
    if (cash < total) {
      return {
        ok: false,
        message: "Cash received is less than the sale total.",
      };
    }
  }

  const normalizedCash = cash != null && cash > 0 ? cash : total;
  return {
    ok: true,
    cashReceived: normalizedCash,
    change: normalizedCash > total ? roundMoney(normalizedCash - total) : 0,
  };
}

export function isDirectSellCategory(value: unknown): boolean {
  const category = String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
  return (
    category === "CHICKEN" ||
    category === "DRINK" ||
    category === "DRINKS" ||
    category === "BEVERAGE" ||
    category === "BEVERAGES"
  );
}

export function saleSourceForLines(
  sources: Iterable<MobileSaleLineSource>,
): MobileSaleSource {
  const unique = new Set(sources);
  if (unique.size === 1 && unique.has("CHICKEN")) return "CHICKEN";
  if (unique.size === 1 && unique.has("BODEGA")) return "BODEGA";
  return "MIXED";
}

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
  | { ok: true; line: ParsedMobileCartLine }
  | { ok: false; message: string };

export type MobileSaleTenderResult =
  | { ok: true; cashReceived: number; change: number }
  | { ok: false; message: string };

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
  const buyingPrice = nonNegativeMoney(
    catalogBuyingPrice ?? item.buyingPrice,
  );
  const sellingPrice = nonNegativeMoney(
    catalogSellingPrice ?? item.sellingPrice,
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

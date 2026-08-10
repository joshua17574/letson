import assert from "node:assert/strict";
import test from "node:test";

import {
  isDirectSellCategory,
  parseMobileCartLine,
  prepareDirectInventorySaleLine,
  pricePerPiece,
  saleSourceForLines,
  serializeMobileInventoryItem,
  validateMobileSaleTender,
} from "../lib/mobile-pos-contract";

test("serializes authoritative bodega prices as per-piece mobile prices", () => {
  const item = serializeMobileInventoryItem(
    {
      _id: "inventory-1",
      productName: "C10",
      categoryName: "CHICKEN",
      productSource: "BODEGA",
      stockQty: 100,
      unitLabel: "PCS",
      packSize: 50,
      lowStockAlert: 5,
      buyingPrice: 250,
      sellingPrice: 350,
    },
    {
      buyingPrice: 300,
      sellingPrice: 377,
    },
  );

  assert.equal(item.buyingPrice, 300);
  assert.equal(item.sellingPrice, 377);
  assert.equal(item.pieceBuyingPrice, 6);
  assert.equal(item.pieceSellingPrice, 8);
});

test("keeps grocery unitPrice per piece even when delivered in a pack", () => {
  const item = serializeMobileInventoryItem(
    {
      _id: "inventory-2",
      productName: "COLA",
      categoryName: "DRINKS",
      productSource: "GROCERY",
      stockQty: 8,
      unitLabel: "QTY",
      packSize: 12,
      lowStockAlert: 2,
      buyingPrice: 8,
      sellingPrice: 0,
    },
    {
      buyingPrice: 9,
      unitPrice: 15,
    },
  );

  assert.equal(item.pieceBuyingPrice, 9);
  assert.equal(item.pieceSellingPrice, 15);
});

test("rounds pack prices to whole pesos and safely handles invalid prices", () => {
  assert.equal(pricePerPiece(374, 50), 7);
  assert.equal(pricePerPiece(377, 50), 8);
  assert.equal(pricePerPiece(15, 0), 15);
  assert.equal(pricePerPiece(Number.NaN, 50), 0);
});

test("parses either a menu or direct-inventory cart line", () => {
  assert.deepEqual(
    parseMobileCartLine({ menuItemId: "menu-1", qty: 2 }),
    { ok: true, line: { kind: "menu", itemId: "menu-1", qty: 2 } },
  );
  assert.deepEqual(
    parseMobileCartLine({ inventoryItemId: "inventory-1", qty: 3 }),
    {
      ok: true,
      line: { kind: "inventory", itemId: "inventory-1", qty: 3 },
    },
  );
});

test("rejects ambiguous or missing mobile cart references", () => {
  assert.deepEqual(
    parseMobileCartLine({
      menuItemId: "menu-1",
      inventoryItemId: "inventory-1",
      qty: 1,
    }),
    {
      ok: false,
      message:
        "Each cart item must provide exactly one of menuItemId or inventoryItemId.",
    },
  );
  assert.deepEqual(parseMobileCartLine({ qty: 1 }), {
    ok: false,
    message:
      "Each cart item must provide exactly one of menuItemId or inventoryItemId.",
  });
});

test("normalizes direct-sell categories and derives the persisted sale source", () => {
  assert.equal(isDirectSellCategory(" chicken "), true);
  assert.equal(isDirectSellCategory("Beverages"), true);
  assert.equal(isDirectSellCategory("INGREDIENTS"), false);
  assert.equal(saleSourceForLines(["CHICKEN"]), "CHICKEN");
  assert.equal(saleSourceForLines(["BODEGA"]), "BODEGA");
  assert.equal(saleSourceForLines(["BODEGA", "CHICKEN"]), "MIXED");
});

test("builds a server-priced chicken sale line from direct outlet inventory", () => {
  const result = prepareDirectInventorySaleLine(
    {
      _id: "inventory-1",
      productId: "bodega-product-1",
      productName: "C10",
      categoryName: "CHICKEN",
      productSource: "BODEGA",
      stockQty: 100,
      packSize: 50,
      buyingPrice: 250,
      sellingPrice: 350,
    },
    { buyingPrice: 300, sellingPrice: 377 },
    2,
  );

  assert.deepEqual(result, {
    ok: true,
    line: {
      source: "CHICKEN",
      productName: "C10",
      categoryName: "CHICKEN",
      qty: 2,
      price: 8,
      lineTotal: 16,
      stockUnit: "QTY",
      packSize: 1,
      stockPcsOut: 2,
      bodegaProductId: "bodega-product-1",
      remarks: "OUTLET_INVENTORY:inventory-1",
    },
    deduction: {
      source: "BODEGA",
      productId: "bodega-product-1",
      qty: 2,
      name: "C10",
      strict: true,
    },
  });
});

test("rejects direct inventory that is not a sell category", () => {
  const result = prepareDirectInventorySaleLine(
    {
      _id: "inventory-2",
      productId: "grocery-product-1",
      productName: "GARLIC",
      categoryName: "INGREDIENTS",
      productSource: "GROCERY",
      stockQty: 10,
      packSize: 0,
    },
    { buyingPrice: 5, unitPrice: 8 },
    1,
  );

  assert.deepEqual(result, {
    ok: false,
    message: "GARLIC is not available for direct sale.",
  });
});

test("requires a finite cash tender for carts with direct inventory", () => {
  assert.deepEqual(validateMobileSaleTender(undefined, 15, true), {
    ok: false,
    message: "Cash received is required for inventory sales.",
  });
  assert.deepEqual(validateMobileSaleTender(Number.POSITIVE_INFINITY, 15, true), {
    ok: false,
    message: "Cash received is required for inventory sales.",
  });
});

test("rejects a low cash tender for carts with direct inventory", () => {
  assert.deepEqual(validateMobileSaleTender(14.99, 15, true), {
    ok: false,
    message: "Cash received is less than the sale total.",
  });
});

test("accepts sufficient cash tender against the authoritative total", () => {
  assert.deepEqual(validateMobileSaleTender(20, 15, true), {
    ok: true,
    cashReceived: 20,
    change: 5,
  });
});

test("preserves legacy menu-only tender behavior", () => {
  assert.deepEqual(validateMobileSaleTender(undefined, 15, false), {
    ok: true,
    cashReceived: 15,
    change: 0,
  });
  assert.deepEqual(validateMobileSaleTender(10, 15, false), {
    ok: true,
    cashReceived: 10,
    change: 0,
  });
});

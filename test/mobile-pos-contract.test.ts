import assert from "node:assert/strict";
import test from "node:test";

import {
  parseMobileCustomerStockTransferRequest,
  mobileExpenseDeleteFilter,
  mobileExpenseOutletPattern,
  isDirectSellCategory,
  normalizeMobileInventoryCategory,
  parseMobileDeductionHistoryQuery,
  parseMobileCartLine,
  parseMobileInventoryDeductionRequest,
  parseMobileMenuPriceUpdateRequest,
  parseMobilePriceUpdateRequest,
  parseMobileSaleReference,
  parseMobileSaleVoidRequest,
  prepareDirectInventorySaleLine,
  pricePerPiece,
  saleSourceForLines,
  serializeMobileInventoryItem,
  validateMobileSaleTender,
} from "../lib/mobile-pos-contract";

test("parses an outlet-to-customer stock transfer", () => {
  assert.deepEqual(
    parseMobileCustomerStockTransferRequest({
      customerName: "  Sari-sari ni Ana  ",
      items: [
        { inventoryId: "507f1f77bcf86cd799439011", qty: 2 },
        { inventoryId: "507f1f77bcf86cd799439012", qty: 5 },
      ],
    }),
    {
      ok: true,
      value: {
        customerName: "Sari-sari ni Ana",
        items: [
          { inventoryId: "507f1f77bcf86cd799439011", qty: 2 },
          { inventoryId: "507f1f77bcf86cd799439012", qty: 5 },
        ],
      },
    },
  );
});

test("rejects invalid outlet-to-customer stock transfers", () => {
  assert.deepEqual(parseMobileCustomerStockTransferRequest({ items: [] }), {
    ok: false,
    message: "Customer name is required.",
  });
  assert.deepEqual(
    parseMobileCustomerStockTransferRequest({
      customerName: "Ana",
      items: [{ inventoryId: "stock-1", qty: 0 }],
    }),
    {
      ok: false,
      message:
        "Each transfer item needs an inventory ID and a whole-piece quantity.",
    },
  );
  assert.deepEqual(
    parseMobileCustomerStockTransferRequest({
      customerName: "Ana",
      items: [
        { inventoryId: "stock-1", qty: 1 },
        { inventoryId: "stock-1", qty: 2 },
      ],
    }),
    {
      ok: false,
      message: "Each inventory item may only appear once per transfer.",
    },
  );
});
import { MOBILE_CASHIER_PERMISSIONS } from "../lib/role-permissions";

test("mobile cashier provisioning includes incoming delivery access", () => {
  assert.equal(MOBILE_CASHIER_PERMISSIONS.includes("stock-transfers.view"), true);
  assert.equal(
    MOBILE_CASHIER_PERMISSIONS.includes("stock-transfers.confirm"),
    true,
  );
});

test("delivery categorization persists only the three outlet stock buckets", () => {
  assert.equal(normalizeMobileInventoryCategory(" chicken "), "CHICKEN");
  assert.equal(normalizeMobileInventoryCategory("drink"), "DRINKS");
  assert.equal(normalizeMobileInventoryCategory("Beverages"), "DRINKS");
  assert.equal(normalizeMobileInventoryCategory("ingredient"), "INGREDIENTS");
  assert.equal(normalizeMobileInventoryCategory("GROCERY"), null);
  assert.equal(normalizeMobileInventoryCategory("Chicken Cuts"), null);
  assert.equal(normalizeMobileInventoryCategory(undefined), null);
});

test("accepts an empty mobile sale void request from existing APKs", () => {
  assert.deepEqual(parseMobileSaleVoidRequest({}), {
    ok: true,
    value: { reason: "", refunded: undefined },
  });
});

test("validates optional mobile sale void details", () => {
  assert.deepEqual(
    parseMobileSaleVoidRequest({ reason: "Customer changed order", refunded: 10 }),
    {
      ok: true,
      value: { reason: "Customer changed order", refunded: 10 },
    },
  );
  assert.equal(parseMobileSaleVoidRequest({ reason: "x".repeat(201) }).ok, false);
  assert.equal(parseMobileSaleVoidRequest({ refunded: -1 }).ok, false);
  assert.equal(parseMobileSaleVoidRequest({ refunded: "not money" }).ok, false);
});

test("parses deduction history date filters and paging", () => {
  const result = parseMobileDeductionHistoryQuery({
    from: "2026-08-01",
    to: "2026-08-11",
    page: "2",
    pageSize: "20",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.page, 2);
  assert.equal(result.value.pageSize, 20);
  assert.equal(result.value.from?.toISOString(), "2026-07-31T16:00:00.000Z");
  assert.equal(
    result.value.toExclusive?.toISOString(),
    "2026-08-11T16:00:00.000Z",
  );
});

test("rejects invalid deduction history ranges and paging", () => {
  assert.equal(
    parseMobileDeductionHistoryQuery({ from: "2026-08-31", to: "2026-08-01" })
      .ok,
    false,
  );
  assert.equal(parseMobileDeductionHistoryQuery({ page: "0" }).ok, false);
  assert.equal(parseMobileDeductionHistoryQuery({ pageSize: "51" }).ok, false);
  assert.equal(
    parseMobileDeductionHistoryQuery({ from: "2026-02-31" }).ok,
    false,
  );
});

test("matches persisted mobile expense history by outlet across shifts", () => {
  const pattern = mobileExpenseOutletPattern("outlet.1");

  assert.equal(pattern.test("MOBILE EXPENSE OUTLET:outlet.1"), true);
  assert.equal(
    pattern.test("MOBILE EXPENSE OUTLET:outlet.1 SHIFT:closed-shift"),
    true,
  );
  assert.equal(
    pattern.test("MOBILE EXPENSE OUTLET:outletX1 SHIFT:open-shift"),
    false,
  );
});

test("scopes mobile expense deletion to an active record in one outlet", () => {
  const expenseId = "507f1f77bcf86cd799439099";
  const filter = mobileExpenseDeleteFilter("outlet.1", expenseId);

  assert.equal(filter._id, expenseId);
  assert.equal(filter.isActive, true);
  assert.match("MOBILE EXPENSE OUTLET:outlet.1", filter.remarks.$regex);
  assert.doesNotMatch("MOBILE EXPENSE OUTLET:outletX1", filter.remarks.$regex);
});

test("parses a positive whole-peso per-piece mobile price update", () => {
  assert.deepEqual(parseMobilePriceUpdateRequest({ sell: 12 }), {
    ok: true,
    value: { sell: 12 },
  });
});

test("rejects invalid mobile price updates", () => {
  assert.equal(parseMobilePriceUpdateRequest({ sell: 0 }).ok, false);
  assert.equal(parseMobilePriceUpdateRequest({ sell: -1 }).ok, false);
  assert.equal(parseMobilePriceUpdateRequest({ sell: 12.5 }).ok, false);
  assert.equal(parseMobilePriceUpdateRequest({ sell: "nope" }).ok, false);
  assert.equal(parseMobilePriceUpdateRequest({}).ok, false);
});

test("parses a documented mobile menu price update", () => {
  assert.deepEqual(parseMobileMenuPriceUpdateRequest({ price: 89 }), {
    ok: true,
    value: { price: 89 },
  });
});

test("rejects invalid mobile menu price updates", () => {
  assert.equal(parseMobileMenuPriceUpdateRequest({ price: -1 }).ok, false);
  assert.equal(
    parseMobileMenuPriceUpdateRequest({ price: Number.NaN }).ok,
    false,
  );
  assert.equal(parseMobileMenuPriceUpdateRequest({ price: "nope" }).ok, false);
  assert.equal(parseMobileMenuPriceUpdateRequest({}).ok, false);
});

test("normalizes uppercased persisted mobile sale references", () => {
  assert.equal(
    parseMobileSaleReference(
      "OUTLET_INVENTORY:6A730F9989FF258F10E0333D",
      "OUTLET_INVENTORY",
    ),
    "6a730f9989ff258f10e0333d",
  );
  assert.equal(
    parseMobileSaleReference("MENU:6A730F9989FF258F10E0333D", "MENU"),
    "6a730f9989ff258f10e0333d",
  );
});

test("parses an outlet ingredient deduction request", () => {
  assert.deepEqual(
    parseMobileInventoryDeductionRequest({
      items: [{ inventoryId: "inventory-1", qty: 3 }],
      remarks: "  Spoilage  ",
    }),
    {
      ok: true,
      value: {
        items: [{ inventoryId: "inventory-1", qty: 3 }],
        remarks: "Spoilage",
      },
    },
  );
});

test("rejects invalid outlet ingredient deductions", () => {
  assert.deepEqual(parseMobileInventoryDeductionRequest({ items: [] }), {
    ok: false,
    message: "At least one ingredient is required.",
  });
  assert.deepEqual(
    parseMobileInventoryDeductionRequest({
      items: [{ inventoryId: "inventory-1", qty: 0 }],
    }),
    {
      ok: false,
      message:
        "Each deduction needs an inventory ID and a whole-piece quantity.",
    },
  );
  assert.equal(
    parseMobileInventoryDeductionRequest({
      items: [{ inventoryId: "inventory-1", qty: 1.5 }],
    }).ok,
    false,
  );
  assert.deepEqual(
    parseMobileInventoryDeductionRequest({
      items: [
        { inventoryId: "inventory-1", qty: 1 },
        { inventoryId: "inventory-1", qty: 2 },
      ],
    }),
    {
      ok: false,
      message: "Each ingredient may only appear once per deduction.",
    },
  );
});

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

test("an outlet price override wins without changing the shared catalog", () => {
  const item = serializeMobileInventoryItem(
    {
      _id: "inventory-1",
      productName: "C10",
      categoryName: "CHICKEN",
      productSource: "BODEGA",
      stockQty: 100,
      packSize: 50,
      sellingPrice: 377,
      sellingPriceOverride: 600,
    },
    { sellingPrice: 377 },
  );

  assert.equal(item.sellingPrice, 600);
  assert.equal(item.pieceSellingPrice, 12);
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
  assert.deepEqual(parseMobileCartLine({ menuItemId: "menu-1", qty: 2 }), {
    ok: true,
    line: { kind: "menu", itemId: "menu-1", qty: 2 },
  });
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
      inventoryId: "inventory-1",
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
  assert.deepEqual(
    validateMobileSaleTender(Number.POSITIVE_INFINITY, 15, true),
    {
      ok: false,
      message: "Cash received is required for inventory sales.",
    },
  );
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

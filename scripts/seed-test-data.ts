// scripts/seed-test-data.ts
//
// Seeds realistic [TEST] data across the whole system so you can click through
// every feature. SAFE for a database that already has real data:
//
//   * Every record it creates is marked with the "[TEST]" prefix in its name
//     (and test sales/payments use a TEST- receipt/reference prefix).
//   * It NEVER deletes or edits anything. It only inserts.
//   * It refuses to run without the --confirm flag.
//   * A matching remover (scripts/cleanup-test-data.ts) deletes ONLY the
//     [TEST] records it created, leaving your real data untouched.
//
// USAGE (from project root, with production/Atlas MONGODB_URI in your env):
//   npx tsx scripts/seed-test-data.ts --confirm
//
// To remove it all again:
//   npx tsx scripts/cleanup-test-data.ts --confirm
//
// Always take an Atlas backup snapshot before running anything on real data.

import dotenv from "dotenv";
import path from "node:path";
import mongoose from "mongoose";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

import CategoryModel from "@/models/Category";
import SupplierModel from "@/models/Supplier";
import CustomerModel from "@/models/Customer";
import OutletModel from "@/models/Outlet";
import ProductModel from "@/models/Product";
import BodegaProductModel from "@/models/BodegaProduct";
import StandardPackingModel from "@/models/StandardPacking";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";
import InventoryTransactionModel from "@/models/InventoryTransaction";
import ExpenseModel from "@/models/Expense";
import SaleModel from "@/models/Sale";
import SaleLineModel from "@/models/SaleLine";
import PaymentModel from "@/models/Payment";
import PaymentAllocationModel from "@/models/PaymentAllocation";
import SlicingBatchModel from "@/models/SlicingBatch";
import SlicingItemModel from "@/models/SlicingItem";
import OutletInventoryModel from "@/models/OutletInventory";
import OutletStockTransactionModel from "@/models/OutletStockTransaction";
import StockTransferModel from "@/models/StockTransfer";
import StockTransferItemModel from "@/models/StockTransferItem";
import UserModel from "@/models/User";

export const TEST_PREFIX = "[TEST]";

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  return new Date(d.getTime() - n * 24 * 60 * 60 * 1000);
}

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const DAYS = 10;

const CUSTOMER_NAMES = [
  "Aling Nena Carinderia",
  "Kuya Boy Eatery",
  "Mang Inasal Toril",
  "Davao Lutong Bahay",
  "Lola Rosing Turo-Turo",
  "JJ Grill House",
  "Bankerohan Fresh Mart",
  "Matina Food Hub",
  "Panabo Chicken Haus",
  "Tagum Meat Supply",
];

const OUTLET_DEFS = [
  { name: "Toril Branch", code: "TEST-TORIL", manager: "Manang Rosa" },
  { name: "Matina Branch", code: "TEST-MATINA", manager: "Mang Tonio" },
  { name: "Bajada Branch", code: "TEST-BAJADA", manager: "Ate Lyn" },
  { name: "Buhangin Branch", code: "TEST-BUHANGIN", manager: "Kuya Ramon" },
  { name: "Panabo Branch", code: "TEST-PANABO", manager: "Sir Dado" },
];

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "Refusing to run without --confirm. Usage: npx tsx scripts/seed-test-data.ts --confirm"
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set (check your .env). Aborting.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected. Seeding heavy 10-day [TEST] dataset...\n");

  const admin = await UserModel.findOne({ role: "ADMIN" }).select("_id").lean();
  const createdBy = admin?._id;

  // ---- Categories ----------------------------------------------------------
  const [catChicken, catGrocery] = await (CategoryModel as any).create([
    { name: `${TEST_PREFIX} Chicken Parts`, description: "Test category" },
    { name: `${TEST_PREFIX} Grocery Items`, description: "Test category" },
  ]);
  console.log("Categories: 2");

  // ---- Suppliers -----------------------------------------------------------
  await (SupplierModel as any).create([
    { name: `${TEST_PREFIX} Davao Poultry Supply`, phone: "0917-000-1111", address: "Bankerohan, Davao City" },
    { name: `${TEST_PREFIX} Mindanao Grocery Distributor`, phone: "0917-222-3333", address: "Agdao, Davao City" },
  ]);
  console.log("Suppliers: 2");

  // ---- 10 Customers --------------------------------------------------------
  const customers: any[] = await (CustomerModel as any).create(
    CUSTOMER_NAMES.map((name, i) => ({
      name: `${TEST_PREFIX} ${name}`,
      phone: `0918-${String(100 + i).padStart(3, "0")}-${String(1000 + i)}`,
      address: "Davao Region",
      type: i % 3 === 0 ? "BOTH" : "SALE",
      createdBy,
    }))
  );
  console.log(`Customers: ${customers.length}`);

  // ---- 5 Outlets -----------------------------------------------------------
  const outlets: any[] = await (OutletModel as any).create(
    OUTLET_DEFS.map((o) => ({
      name: `${TEST_PREFIX} ${o.name}`,
      code: o.code,
      address: `${o.name} Public Market`,
      managerName: o.manager,
      contactNumber: "0920-000-0000",
      status: "ACTIVE",
      createdBy,
    }))
  );
  console.log(`Outlets: ${outlets.length}`);

  // ---- Grocery products ----------------------------------------------------
  const groceryProducts: any[] = await (ProductModel as any).create([
    { name: `${TEST_PREFIX} Cooking Oil 1L`, categoryId: catGrocery._id, buyingPrice: 85, unitPrice: 110, stockPcs: 5000, lowStockAlert: 50 },
    { name: `${TEST_PREFIX} Soy Sauce 1L`, categoryId: catGrocery._id, buyingPrice: 40, unitPrice: 60, stockPcs: 5000, lowStockAlert: 50 },
    { name: `${TEST_PREFIX} Rice 25kg`, categoryId: catGrocery._id, buyingPrice: 1200, unitPrice: 1450, stockPcs: 1000, lowStockAlert: 20 },
    { name: `${TEST_PREFIX} Vinegar 1L`, categoryId: catGrocery._id, buyingPrice: 30, unitPrice: 48, stockPcs: 5000, lowStockAlert: 50 },
  ]);
  console.log(`Grocery products: ${groceryProducts.length}`);

  // ---- Bodega products -----------------------------------------------------
  const wholeChicken = await (BodegaProductModel as any).create({
    name: `${TEST_PREFIX} Whole Chicken`, categoryId: catChicken._id, stockQty: 100000, buyingPrice: 160, sellingPrice: 0,
  });
  const slicedC10 = await (BodegaProductModel as any).create({
    name: `${TEST_PREFIX} Chicken Cut C10`, categoryId: catChicken._id, stockQty: 0, buyingPrice: 18, sellingPrice: 25,
  });
  const legQuarter = await (BodegaProductModel as any).create({
    name: `${TEST_PREFIX} Leg Quarter`, categoryId: catChicken._id, stockQty: 20000, buyingPrice: 70, sellingPrice: 95,
  });
  const chickenWings = await (BodegaProductModel as any).create({
    name: `${TEST_PREFIX} Chicken Wings`, categoryId: catChicken._id, stockQty: 15000, buyingPrice: 90, sellingPrice: 120,
  });
  console.log("Bodega products: 4");

  // C10 is a pack product (10 pcs/pack)
  const packingC10 = await (StandardPackingModel as any).create({
    wholeChickenId: wholeChicken._id, productId: slicedC10._id, standardPacking: 10, standardSlice: 34, chickenSizeType: "MEDIUM",
  });
  console.log("Standard packing: 1 (C10 = 10 pcs/pack)");

  // Running stock trackers (kept positive)
  let c10Stock = 0;
  let legStock = 20000;
  let wingStock = 15000;
  const groceryStock = groceryProducts.map((p: any) => Number(p.stockPcs));

  // ---- Per-day slicing (replenish C10) -------------------------------------
  let slicingCount = 0;
  const EXPENSE_TYPES_BODEGA = ["SALARIES", "MARINATE_EXPENSES", "DELIVERY_EXPENSES", "REPAIR_AND_MAINTENANCE"];
  const EXPENSE_TYPES_GROCERY = ["TRANSPORTATION_EXPENSES", "CLEANING_SUPPLIES", "OFFICE_SUPPLIES", "OTHERS"];

  let saleSeq = 0;
  let transferSeq = 0;
  let totalSales = 0;
  let totalPayments = 0;
  let totalExpenses = 0;
  let totalTransfers = 0;

  for (let d = DAYS; d >= 1; d -= 1) {
    const date = daysAgo(d);

    // --- Slicing: 1-2 batches/day, whole chicken -> C10 ---
    const batchesToday = randInt(1, 2);
    for (let b = 0; b < batchesToday; b += 1) {
      // const heads = randInt(15, 30);
      const heads = 1;
      const actualSlicedPcs = heads * 34;
      const prevWhole = 100000 - slicingCount * 0; // informational only

      const batch = await (SlicingBatchModel as any).create({
        slicingDate: date,
        slicer: `${TEST_PREFIX} Slicer ${(b % 2) + 1}`,
        packer: `${TEST_PREFIX} Packer ${(b % 2) + 1}`,
        totalHeads: heads,
        totalActualPcs: actualSlicedPcs,
        remarks: `${TEST_PREFIX} Slicing batch`,
        createdBy,
      });
      await (SlicingItemModel as any).create({
        batchId: batch._id,
        standardId: packingC10._id,
        mainProductId: wholeChicken._id,
        mainProductName: wholeChicken.name,
        slicedProductId: slicedC10._id,
        slicedProductName: slicedC10.name,
        heads,
        standardSlice: 34,
        standardPacking: 50,
        actualSlicedPcs,
      });
      await (BodegaProductModel as any).updateOne({ _id: wholeChicken._id }, { $inc: { stockQty: -heads } });
      await (BodegaProductModel as any).updateOne({ _id: slicedC10._id }, { $inc: { stockQty: actualSlicedPcs } });
      await (BodegaStockTransactionModel as any).create([
        { bodegaProductId: wholeChicken._id, type: "STOCK_OUT", quantity: heads, previousStock: 0, newStock: 0, remarks: `${TEST_PREFIX} SLICING`, referenceType: "SLICING_BATCH", referenceId: batch._id, createdBy },
        { bodegaProductId: slicedC10._id, type: "STOCK_IN", quantity: actualSlicedPcs, previousStock: c10Stock, newStock: c10Stock + actualSlicedPcs, remarks: `${TEST_PREFIX} SLICING`, referenceType: "SLICING_BATCH", referenceId: batch._id, createdBy },
      ]);
      void prevWhole;
      c10Stock += actualSlicedPcs;
      slicingCount += 1;
    }

    // --- Sales: 8-14 per day across random customers (HEAVY) ---
    const salesToday = randInt(8, 14);
    for (let s = 0; s < salesToday; s += 1) {
      const customer = pick(customers, randInt(0, customers.length - 1));
      const isChicken = Math.random() < 0.55;
      saleSeq += 1;
      const receiptNumber = `TEST-${String(saleSeq).padStart(5, "0")}`;

      if (isChicken) {
        // Sell C10 in packs (PACK) OR leg/wings by... CHICKEN must be PACK unit.
        // Use C10 packs to respect the PACK convention.
        const packs = randInt(1, 6);
        const pcs = packs * 10;
        if (c10Stock < pcs) continue;
        const price = 250;
        const total = price * packs;
        const paid = Math.random() < 0.7;

        const sale = await (SaleModel as any).create({
          receiptNumber, customerId: customer._id, saleDate: date, source: "CHICKEN",
          totalAmount: total, paidAmount: paid ? total : 0, balance: paid ? 0 : total,
          totalPacks: packs, totalQty: packs, status: paid ? "PAID" : "UNPAID", createdBy,
        });
        await (SaleLineModel as any).create({
          saleId: sale._id, source: "CHICKEN", bodegaProductId: slicedC10._id,
          categoryName: catChicken.name, productName: slicedC10.name,
          qty: packs, price, lineTotal: total, stockUnit: "PACK", packSize: 10, stockPcsOut: pcs,
        });
        await (BodegaProductModel as any).updateOne({ _id: slicedC10._id }, { $inc: { stockQty: -pcs } });
        c10Stock -= pcs;
        totalSales += total;

        if (paid) {
          const payment = await (PaymentModel as any).create({
            customerId: customer._id, paymentDate: date, amount: total, appliedAmount: total, unappliedAmount: 0,
            remarks: `${TEST_PREFIX} Payment for ${receiptNumber}`, createdBy,
          });
          await (PaymentAllocationModel as any).create({ paymentId: payment._id, saleId: sale._id, amount: total });
          totalPayments += total;
        }
      } else {
        // Grocery sale (QTY)
        const gi = randInt(0, groceryProducts.length - 1);
        const product = groceryProducts[gi];
        const qty = randInt(2, 12);
        if (groceryStock[gi] < qty) continue;
        const price = Number(product.unitPrice);
        const total = price * qty;
        const paid = Math.random() < 0.7;

        const sale = await (SaleModel as any).create({
          receiptNumber, customerId: customer._id, saleDate: date, source: "BODEGA",
          totalAmount: total, paidAmount: paid ? total : 0, balance: paid ? 0 : total,
          totalQty: qty, status: paid ? "PAID" : "UNPAID", createdBy,
        });
        await (SaleLineModel as any).create({
          saleId: sale._id, source: "BODEGA", productId: product._id,
          categoryName: catGrocery.name, productName: product.name,
          qty, price, lineTotal: total, stockUnit: "QTY", packSize: 1, stockPcsOut: qty,
        });
        await (ProductModel as any).updateOne({ _id: product._id }, { $inc: { stockPcs: -qty } });
        groceryStock[gi] -= qty;
        totalSales += total;

        if (paid) {
          const payment = await (PaymentModel as any).create({
            customerId: customer._id, paymentDate: date, amount: total, appliedAmount: total, unappliedAmount: 0,
            remarks: `${TEST_PREFIX} Payment for ${receiptNumber}`, createdBy,
          });
          await (PaymentAllocationModel as any).create({ paymentId: payment._id, saleId: sale._id, amount: total });
          totalPayments += total;
        }
      }
    }

    // --- Expenses: 2-4 per day, mixed business ---
    const expensesToday = randInt(2, 4);
    for (let e = 0; e < expensesToday; e += 1) {
      const bodega = Math.random() < 0.5;
      const amount = randInt(2, 30) * 50;
      await (ExpenseModel as any).create({
        name: `${TEST_PREFIX} ${bodega ? "Bodega" : "Grocery"} expense`,
        expenseCategory: bodega ? "BODEGA" : "GROCERY",
        type: bodega ? pick(EXPENSE_TYPES_BODEGA, e) : pick(EXPENSE_TYPES_GROCERY, e),
        expenseDate: date, amount, createdBy,
      });
      totalExpenses += amount;
    }

    // --- Stock transfers: 1-2 per day to random outlets, mostly CONFIRMED ---
    const transfersToday = randInt(1, 2);
    for (let t = 0; t < transfersToday; t += 1) {
      const outlet = pick(outlets, randInt(0, outlets.length - 1));
      transferSeq += 1;
      const transferNumber = `TEST-TRF-${String(transferSeq).padStart(4, "0")}`;

      // Mix: C10 packs + leg quarter pcs
      const c10Packs = randInt(2, 8);
      const c10Pcs = c10Packs * 10;
      const legPcs = randInt(10, 40);
      if (c10Stock < c10Pcs || legStock < legPcs) continue;

      const confirmed = Math.random() < 0.8; // 80% confirmed, 20% left in transit
      const hasDisc = confirmed && Math.random() < 0.25; // some discrepancies
      const legReceived = hasDisc ? legPcs - randInt(1, 5) : legPcs;
      const legVariance = legPcs - legReceived;
      const totalQtyPcs = c10Pcs + legPcs;
      const receivedPcs = c10Pcs + legReceived;

      const transfer = await (StockTransferModel as any).create({
        transferNumber, outletId: outlet._id,
        status: confirmed ? "CONFIRMED" : "IN_TRANSIT",
        transferDate: date,
        totalItems: 2, totalQty: totalQtyPcs,
        totalReceivedQty: confirmed ? receivedPcs : 0,
        totalVarianceQty: confirmed ? legVariance : 0,
        hasDiscrepancy: hasDisc,
        remarks: `${TEST_PREFIX} Stock transfer`,
        outletRemarks: hasDisc ? `${TEST_PREFIX} Some leg quarters short on arrival` : "",
        dispatchedAt: date, deliveredAt: confirmed ? date : undefined, confirmedAt: confirmed ? date : undefined,
        createdBy, dispatchedBy: createdBy, confirmedBy: confirmed ? createdBy : undefined,
      });

      await (StockTransferItemModel as any).create([
        {
          transferId: transfer._id, source: "BODEGA", bodegaProductId: slicedC10._id,
          productName: slicedC10.name, categoryName: catChicken.name, packSize: 10, unitLabel: "PACK",
          buyingPrice: 18, sellingPrice: 25, qty: c10Packs, qtyPcs: c10Pcs,
          receivedQty: confirmed ? c10Packs : 0, receivedPcs: confirmed ? c10Pcs : 0,
          varianceQty: 0, itemStatus: confirmed ? "ACCEPTED" : "PENDING",
        },
        {
          transferId: transfer._id, source: "BODEGA", bodegaProductId: legQuarter._id,
          productName: legQuarter.name, categoryName: catChicken.name, packSize: 0, unitLabel: "PCS",
          buyingPrice: 70, sellingPrice: 95, qty: legPcs, qtyPcs: legPcs,
          receivedQty: confirmed ? legReceived : 0, receivedPcs: confirmed ? legReceived : 0,
          varianceQty: confirmed ? legVariance : 0,
          itemStatus: confirmed ? (legVariance > 0 ? "PARTIAL" : "ACCEPTED") : "PENDING",
          remarks: hasDisc ? `${TEST_PREFIX} ${legVariance} pcs short` : "",
        },
      ]);

      // Dispatch always deducts main-branch stock
      await (BodegaProductModel as any).updateOne({ _id: slicedC10._id }, { $inc: { stockQty: -c10Pcs } });
      await (BodegaProductModel as any).updateOne({ _id: legQuarter._id }, { $inc: { stockQty: -legPcs } });
      c10Stock -= c10Pcs;
      legStock -= legPcs;
      await (BodegaStockTransactionModel as any).create([
        { bodegaProductId: slicedC10._id, type: "STOCK_OUT", quantity: c10Pcs, previousStock: 0, newStock: 0, remarks: `${TEST_PREFIX} STOCK TRANSFER ${transferNumber}`, referenceType: "STOCK_TRANSFER", referenceId: transfer._id, createdBy },
        { bodegaProductId: legQuarter._id, type: "STOCK_OUT", quantity: legPcs, previousStock: 0, newStock: 0, remarks: `${TEST_PREFIX} STOCK TRANSFER ${transferNumber}`, referenceType: "STOCK_TRANSFER", referenceId: transfer._id, createdBy },
      ]);
      totalTransfers += 1;

      // If confirmed, increase outlet inventory + ledger for received pcs
      if (confirmed) {
        const items: Array<{ pid: any; name: string; cat: string; pack: number; buy: number; sell: number; recv: number }> = [
          { pid: slicedC10._id, name: slicedC10.name, cat: catChicken.name, pack: 10, buy: 18, sell: 25, recv: c10Pcs },
          { pid: legQuarter._id, name: legQuarter.name, cat: catChicken.name, pack: 0, buy: 70, sell: 95, recv: legReceived },
        ];
        for (const it of items) {
          if (it.recv <= 0) continue;
          const existing = await (OutletInventoryModel as any).findOneAndUpdate(
            { outletId: outlet._id, productSource: "BODEGA", productId: it.pid, isActive: true },
            { $inc: { stockQty: it.recv } },
            { new: true }
          );
          let invId = existing?._id;
          let prev = 0;
          let next = it.recv;
          if (existing) { next = Number(existing.stockQty || 0); prev = next - it.recv; }
          else {
            const created = await (OutletInventoryModel as any).create({
              outletId: outlet._id, productSource: "BODEGA", productId: it.pid, productName: it.name,
              categoryName: it.cat, stockQty: it.recv, unitLabel: "PCS", packSize: it.pack, lowStockAlert: 0,
              buyingPrice: it.buy, sellingPrice: it.sell, createdBy,
            });
            invId = created._id;
          }
          await (OutletStockTransactionModel as any).create({
            outletId: outlet._id, outletInventoryId: invId, productSource: "BODEGA", productId: it.pid,
            productName: it.name, transactionDate: date, type: "DELIVERY_RECEIVED", quantity: it.recv,
            previousStock: prev, newStock: next, referenceType: "STOCK_TRANSFER", referenceId: transfer._id,
            sourceChannel: "WEB", remarks: `${TEST_PREFIX} TRANSFER ${transferNumber}`, createdBy,
          });
        }
      }
    }
  }

  // One DRAFT transfer so you can test dispatch/cancel in the UI
  if (legStock >= 30) {
    const draft = await (StockTransferModel as any).create({
      transferNumber: `TEST-TRF-${String(transferSeq + 1).padStart(4, "0")}`,
      outletId: outlets[0]._id, status: "DRAFT", transferDate: new Date(),
      totalItems: 1, totalQty: 30, remarks: `${TEST_PREFIX} Draft transfer to test dispatch`, createdBy,
    });
    await (StockTransferItemModel as any).create({
      transferId: draft._id, source: "BODEGA", bodegaProductId: legQuarter._id,
      productName: legQuarter.name, categoryName: catChicken.name, packSize: 0, unitLabel: "PCS",
      buyingPrice: 70, sellingPrice: 95, qty: 30, qtyPcs: 30, receivedQty: 0, receivedPcs: 0,
      varianceQty: 0, itemStatus: "PENDING",
    });
  }

  console.log(`\nSeeded over ${DAYS} days:`);
  console.log(`  Sales receipts:     ${saleSeq}  (~₱${totalSales.toLocaleString()})`);
  console.log(`  Payments collected: ~₱${totalPayments.toLocaleString()}`);
  console.log(`  Expenses recorded:  ~₱${totalExpenses.toLocaleString()}`);
  console.log(`  Slicing batches:    ${slicingCount}`);
  console.log(`  Stock transfers:    ${totalTransfers} (+1 draft)`);
  console.log("\nAll records are marked with the [TEST] prefix.");
  console.log("Remove them anytime with: npm run cleanup:test");

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

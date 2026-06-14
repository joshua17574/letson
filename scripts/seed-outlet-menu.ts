// scripts/seed-outlet-menu.ts
//
// Adds a sample POS menu to an outlet so you can test selling on the mobile app.
//
// It creates: Fried Chicken C10 (15), Fried Chicken C59 (40), Coke Sakto (12),
// Rice (15). Where the outlet already stocks a matching raw item (by name
// keyword), the menu item is mapped to deduct 1 unit per sale; otherwise it
// sells with no stock deduction (you can map it later in the web menu manager).
//
// USAGE (from the main-system project root):
//   CASHIER_OUTLET_CODE=TEST-TORIL npx tsx scripts/seed-outlet-menu.ts
// or omit to use the first active outlet:
//   npx tsx scripts/seed-outlet-menu.ts

import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

type MenuDef = {
  name: string;
  category: string;
  price: number;
  // keyword to match an existing outlet-inventory item name (optional mapping)
  stockKeyword?: string;
  qtyPerSale?: number;
};

const MENU: MenuDef[] = [
  { name: "Fried Chicken C10", category: "Chicken", price: 15, stockKeyword: "c10", qtyPerSale: 1 },
  { name: "Fried Chicken C59", category: "Chicken", price: 40, stockKeyword: "leg", qtyPerSale: 1 },
  { name: "Coke Sakto", category: "Drinks", price: 12, stockKeyword: "coke" },
  { name: "Rice", category: "Rice", price: 15, stockKeyword: "rice" },
  { name: "Chicken Meal (1pc + Rice)", category: "Meals", price: 45, stockKeyword: "c10", qtyPerSale: 1 },
];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required in .env.");

  const outletCode = String(process.env.CASHIER_OUTLET_CODE || "").trim();

  const { default: dbConnect } = await import("../lib/mongodb");
  const { default: OutletModel } = await import("../models/Outlet");
  const { default: OutletInventoryModel } = await import("../models/OutletInventory");
  const { default: OutletMenuItemModel } = await import("../models/OutletMenuItem");

  await dbConnect();

  const outlet = outletCode
    ? await OutletModel.findOne({ code: outletCode })
    : await OutletModel.findOne({ isActive: true, status: "ACTIVE" }).sort({ name: 1 });

  if (!outlet) {
    throw new Error(
      outletCode
        ? `No outlet found with code "${outletCode}".`
        : "No active outlet found. Create an outlet first."
    );
  }

  // Load this outlet's raw stock so we can map components by name keyword.
  const inventory = await OutletInventoryModel.find({
    outletId: outlet._id,
    isActive: true,
  })
    .select("productSource productId productName")
    .lean();

  function findStock(keyword?: string) {
    if (!keyword) return null;
    const k = keyword.toLowerCase();
    return (
      (inventory as any[]).find((inv) =>
        String(inv.productName || "").toLowerCase().includes(k)
      ) || null
    );
  }

  let created = 0;
  let mapped = 0;
  let sortOrder = 0;

  for (const def of MENU) {
    sortOrder += 1;

    // Skip if a menu item with this name already exists for the outlet.
    const exists = await OutletMenuItemModel.findOne({
      outletId: outlet._id,
      name: def.name,
      isActive: true,
    });
    if (exists) continue;

    const stock = findStock(def.stockKeyword);
    const components = stock
      ? [
          {
            productSource: stock.productSource,
            productId: stock.productId,
            productName: stock.productName,
            qtyPerSale: def.qtyPerSale ?? 1,
          },
        ]
      : [];

    await OutletMenuItemModel.create({
      outletId: outlet._id,
      name: def.name,
      category: def.category,
      price: def.price,
      sortOrder,
      isAvailable: true,
      components,
    });

    created += 1;
    if (components.length > 0) mapped += 1;
  }

  console.log(`Outlet: ${outlet.name} (${outlet.code})`);
  console.log(`Menu items created: ${created} (${mapped} mapped to raw stock)`);
  console.log("Open the mobile app -> Sell tab to see them.");

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

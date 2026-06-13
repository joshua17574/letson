// scripts/cleanup-customer-deliveries.ts
//
// OPTIONAL one-time cleanup for the removed Customer Deliveries feature.
//
// The application code for Customer Deliveries has been removed, but your
// existing data was intentionally left untouched. Run this ONLY when you are
// certain you no longer need the historical customer-delivery records.
//
// What it does:
//   1. Drops the `customerdeliveries` and `customerdeliveryitems` collections.
//   2. Removes the stale "customer-deliveries.view" / ".manage" permissions
//      from every Role document.
//
// What it does NOT touch:
//   - Sales, customers, or any stock ledgers.
//   - The CustomerInventory collection (that feature was kept).
//
// USAGE (from the project root, with your production MONGODB_URI set):
//   npx tsx scripts/cleanup-customer-deliveries.ts
//
// SAFETY: take a database backup first. This deletes data permanently.

import mongoose from "mongoose";

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("MONGODB_URI is not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  if (!db) {
    console.error("No database handle. Aborting.");
    process.exit(1);
  }

  const collections = await db.listCollections().toArray();
  const names = new Set(collections.map((c) => c.name));

  for (const name of ["customerdeliveries", "customerdeliveryitems"]) {
    if (names.has(name)) {
      await db.collection(name).drop();
      console.log(`Dropped collection: ${name}`);
    } else {
      console.log(`Collection not found (already gone): ${name}`);
    }
  }

  const result = await db.collection("roles").updateMany({}, {
    $pull: {
      permissions: {
        $in: ["customer-deliveries.view", "customer-deliveries.manage"],
      },
    },
  } as Record<string, unknown>);

  console.log(
    `Removed stale customer-delivery permissions from ${result.modifiedCount} role(s).`
  );

  await mongoose.disconnect();
  console.log("Cleanup complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

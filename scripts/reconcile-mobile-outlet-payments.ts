// Links historical mobile sales to dedicated outlet payment accounts.
//
// Dry run (default):
//   npm run reconcile:outlet-payments
// Apply the verified plan:
//   npm run reconcile:outlet-payments -- --confirm

import dotenv from "dotenv";
import path from "node:path";
import mongoose, { Types } from "mongoose";

dotenv.config({
  path: process.env.MONGODB_ENV_FILE || path.resolve(process.cwd(), ".env"),
  quiet: true,
});

import { resolveMobileSaleOutletId } from "@/lib/mobile-outlet-payments";
import CustomerModel from "@/models/Customer";
import OutletModel from "@/models/Outlet";
import SaleModel from "@/models/Sale";
import UserModel from "@/models/User";

type OutletRecord = {
  _id: Types.ObjectId;
  name: string;
  createdAt: Date;
  createdBy?: Types.ObjectId;
};

type MobileSaleRecord = {
  _id: Types.ObjectId;
  receiptNumber: string;
  remarks?: string;
  source?: string;
  saleDate: Date;
  createdAt: Date;
  createdBy?: Types.ObjectId;
};

type ReconciliationPlan = {
  outlet: OutletRecord;
  sales: MobileSaleRecord[];
  createdBy: Types.ObjectId;
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured.");

  const confirmed = process.argv.includes("--confirm");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });

  try {
    const [outlets, sales] = await Promise.all([
      OutletModel.find({})
        .select("_id name createdAt createdBy")
        .lean<OutletRecord[]>(),
      SaleModel.find({
        receiptNumber: { $regex: /^MOB-/ },
        isVoided: { $ne: true },
        $or: [{ customerId: { $exists: false } }, { customerId: null }],
      })
        .select("_id receiptNumber remarks source saleDate createdAt createdBy")
        .lean<MobileSaleRecord[]>(),
    ]);

    const outletIdentities = outlets.map((outlet) => ({
      id: outlet._id.toString(),
      createdAt: new Date(outlet.createdAt),
    }));
    const outletById = new Map(
      outlets.map((outlet) => [outlet._id.toString(), outlet]),
    );
    const salesByOutlet = new Map<string, MobileSaleRecord[]>();
    const unresolved: MobileSaleRecord[] = [];

    for (const sale of sales) {
      const outletId = resolveMobileSaleOutletId(
        {
          remarks: sale.remarks,
          source: sale.source,
          saleDate: new Date(sale.saleDate || sale.createdAt),
        },
        outletIdentities,
      );

      if (!outletId || !outletById.has(outletId)) {
        unresolved.push(sale);
        continue;
      }

      const group = salesByOutlet.get(outletId) || [];
      group.push(sale);
      salesByOutlet.set(outletId, group);
    }

    const attributable = [...salesByOutlet.values()].reduce(
      (total, group) => total + group.length,
      0,
    );

    console.log(confirmed ? "Mode: CONFIRM" : "Mode: DRY RUN");
    console.log(`Unlinked mobile sales: ${sales.length}`);
    console.log(`Safely attributable: ${attributable}`);
    console.log(`Unresolved: ${unresolved.length}`);
    console.log(`Affected outlets: ${salesByOutlet.size}`);

    if (unresolved.length > 0) {
      throw new Error(
        `Refusing to continue. Map these unresolved receipts explicitly: ${unresolved
          .map((sale) => sale.receiptNumber)
          .join(", ")}`,
      );
    }

    // Resolve every prerequisite before the first write so confirmation is
    // not allowed to discover a bad account midway through the migration.
    const plan: ReconciliationPlan[] = [];
    for (const [outletId, outletSales] of salesByOutlet) {
      const outlet = outletById.get(outletId);
      if (!outlet) throw new Error(`Outlet ${outletId} no longer exists.`);

      const [existingAccount, fallbackCreator] = await Promise.all([
        CustomerModel.findOne({ outletId: outlet._id })
          .select("_id isActive")
          .lean<{ _id: Types.ObjectId; isActive?: boolean }>(),
        UserModel.findOne({
          isActive: true,
          $or: [{ outletId: outlet._id }, { role: "ADMIN" }],
        })
          .sort({ outletId: -1, createdAt: 1 })
          .select("_id")
          .lean<{ _id: Types.ObjectId }>(),
      ]);

      if (existingAccount?.isActive === false) {
        throw new Error(`Outlet ${outletId} has an inactive payment account.`);
      }

      const creatorId =
        outlet.createdBy ||
        outletSales.find((sale) => sale.createdBy)?.createdBy ||
        fallbackCreator?._id;
      if (!creatorId) {
        throw new Error(
          `Outlet ${outletId} has no creator available for its payment account.`,
        );
      }

      plan.push({ outlet, sales: outletSales, createdBy: creatorId });
    }

    if (!confirmed) {
      console.log("Preflight passed. No data or indexes changed.");
      console.log("Re-run with --confirm to apply this plan.");
      return;
    }

    await CustomerModel.collection.createIndex(
      { outletId: 1 },
      {
        name: "outletId_1",
        unique: true,
        partialFilterExpression: { outletId: { $type: "objectId" } },
      },
    );

    const index = (await CustomerModel.collection.indexes()).find(
      (candidate) => candidate.name === "outletId_1",
    );
    if (
      !index?.unique ||
      index.partialFilterExpression?.outletId?.$type !== "objectId"
    ) {
      throw new Error(
        "The outlet payment account unique index was not verified.",
      );
    }

    const session = await mongoose.startSession();
    let linked = 0;
    try {
      await session.withTransaction(async () => {
        for (const item of plan) {
          const customer = await CustomerModel.findOneAndUpdate(
            { outletId: item.outlet._id },
            {
              $setOnInsert: {
                name: item.outlet.name,
                type: "DELIVERY",
                isActive: true,
                createdBy: item.createdBy,
              },
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true,
              session,
            },
          )
            .select("_id isActive")
            .lean<{ _id: Types.ObjectId; isActive?: boolean }>();

          if (!customer || customer.isActive === false) {
            throw new Error(
              `Outlet ${item.outlet._id.toString()} has no active payment account.`,
            );
          }

          const update = await SaleModel.updateMany(
            {
              _id: { $in: item.sales.map((sale) => sale._id) },
              $or: [{ customerId: { $exists: false } }, { customerId: null }],
            },
            { $set: { customerId: customer._id } },
            { session },
          );
          linked += update.modifiedCount;
        }
      });
    } finally {
      await session.endSession();
    }

    const remaining = await SaleModel.countDocuments({
      receiptNumber: { $regex: /^MOB-/ },
      isVoided: { $ne: true },
      $or: [{ customerId: { $exists: false } }, { customerId: null }],
    });

    console.log(`Linked sales: ${linked}`);
    console.log(`Remaining unresolved sales: ${remaining}`);
    if (remaining !== 0) {
      throw new Error(
        "Reconciliation verification failed: unlinked mobile sales remain.",
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

// scripts/seed-admin.ts
import dotenv from "dotenv";
import path from "node:path";
import bcrypt from "bcryptjs";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

async function main() {
  console.log("MONGODB_URI loaded:", process.env.MONGODB_URI ? "YES" : "NO");

  const { default: dbConnect } = await import("../lib/mongodb");
  const { default: UserModel } = await import("../models/User");
  const { default: RoleModel } = await import("../models/Role");
  const { ROLE_PERMISSION_KEYS } = await import("../lib/role-permissions");

  await dbConnect();

  const username = (
    process.env.SEED_ADMIN_USERNAME || "admin"
  ).toLowerCase();

  const password = process.env.SEED_ADMIN_PASSWORD || "admin12345";
  const name = process.env.SEED_ADMIN_NAME || "ADMIN";
  const email =
    process.env.SEED_ADMIN_EMAIL || `${username}@letson.local`;
  const contact = process.env.SEED_ADMIN_CONTACT || "";

  console.log("Seeding system roles...");

  const adminRole = await RoleModel.findOneAndUpdate(
    {
      name: "ADMIN",
    },
    {
      $set: {
        name: "ADMIN",
        description: "System administrator with full access.",
        permissions: ROLE_PERMISSION_KEYS,
        isSystem: true,
        isActive: true,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  await RoleModel.findOneAndUpdate(
    {
      name: "CASHIER",
    },
    {
      $setOnInsert: {
        name: "CASHIER",
        description: "Cashier role for sales and payment operations.",
        permissions: [
          "dashboard.view",
          "sales.view",
          "sales.manage",
          "payments.view",
          "payments.manage",
        ],
        isSystem: false,
        isActive: true,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  await RoleModel.findOneAndUpdate(
    {
      name: "INVENTORY STAFF",
    },
    {
      $setOnInsert: {
        name: "INVENTORY STAFF",
        description: "Inventory staff role for stock and product operations.",
        permissions: [
          "dashboard.view",
          "products.view",
          "bodega-products.view",
          "purchase-items.view",
          "purchase-items.manage",
          "supplier-deliveries.view",
          "supplier-deliveries.manage",
          "inventory.view",
          "inventory.manage",
        ],
        isSystem: false,
        isActive: true,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  await RoleModel.findOneAndUpdate(
    {
      name: "MANAGER",
    },
    {
      $setOnInsert: {
        name: "MANAGER",
        description: "Manager role for reports, sales, inventory, and payments.",
        permissions: [
          "dashboard.view",
          "customers.view",
          "suppliers.view",
          "products.view",
          "bodega-products.view",
          "purchase-items.view",
          "supplier-deliveries.view",
          "slicing.view",
          "sales.view",
          "sales-lines.view",
          "payments.view",
          "inventory.view",
          "reports.sales",
          "reports.inventory",
          "reports.payments",
          "reports.customer-balance",
          "reports.product-movement",
          "reports.profit",
        ],
        isSystem: false,
        isActive: true,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log("System roles seeded.");

  const existingUser = await UserModel.findOne({
    username,
  });

  const hashedPassword = await bcrypt.hash(password, 12);

  if (existingUser) {
    existingUser.name = name.toUpperCase();
    existingUser.username = username;
    existingUser.email = email.toLowerCase();
    existingUser.role = "ADMIN";
    existingUser.roleId = adminRole._id;
    existingUser.isActive = true;

    // Optional old fields if your User model still has them.
    (existingUser as any).contact = contact;
    (existingUser as any).position = "Admin";

    if (process.env.SEED_ADMIN_RESET_PASSWORD === "true") {
      existingUser.password = hashedPassword;
      console.log("Admin password reset because SEED_ADMIN_RESET_PASSWORD=true");
    }

    await existingUser.save();

    console.log(`Admin user already exists and was updated: ${username}`);
    console.log(`Role assigned: ADMIN`);
    process.exit(0);
  }

  await UserModel.create({
    name: name.toUpperCase(),
    username,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: "ADMIN",
    roleId: adminRole._id,
    isActive: true,

    // Optional old fields if your User model still has them.
    // contact,
    // position: "Admin",
  });

  console.log("Admin user created successfully.");
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  console.log("Role assigned: ADMIN");

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
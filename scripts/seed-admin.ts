// scripts/seed-admin.ts
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

async function main() {
  console.log("MONGODB_URI loaded:", process.env.MONGODB_URI ? "YES" : "NO");

  const { default: dbConnect } = await import("../lib/mongodb");
  const { default: UserModel } = await import("../models/User");

  await dbConnect();

  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin12345";
  const name = process.env.SEED_ADMIN_NAME || "ADMIN";
  const contact = process.env.SEED_ADMIN_CONTACT || "";

  const existingUser = await UserModel.findOne({
    username: username.toLowerCase(),
  });

  if (existingUser) {
    console.log(`Admin user already exists: ${username}`);
    process.exit(0);
  }

  const admin = new UserModel({
    username,
    password,
    name,
    contact,
    role: "ADMIN",
    position: "Admin",
    isActive: true,
  });

  await admin.save();

  console.log("Admin user created successfully.");
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
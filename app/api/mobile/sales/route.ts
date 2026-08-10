// app/api/mobile/sales/route.ts
//
// Records a cash sale from the mobile cashier. Each cart line references either
// a menu item or directly sellable outlet inventory. We total it, create the
// Sale (+ lines), and deduct outlet stock — all in one transaction.
//
// Cash only, walk-in by default (no customer). Out-of-stock components do NOT
// block the sale (a POS shouldn't freeze at the counter); the shortfall is
// recorded and returned as a warning.

import { NextRequest, NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { manilaDateString } from "@/lib/date-utils";
import { ensureMongooseOutletPaymentCustomer } from "@/lib/mongoose-outlet-payment-customer";
import { mobileOutletSalesFilter } from "@/lib/mobile-outlet-payments";
import {
  parseMobileCartLine,
  prepareDirectInventorySaleLine,
  pricePerPiece,
  saleSourceForLines,
  validateMobileSaleTender,
  type CatalogPriceRecord,
  type ParsedMobileCartLine,
} from "@/lib/mobile-pos-contract";
import BodegaProductModel from "@/models/BodegaProduct";
import OutletMenuItemModel from "@/models/OutletMenuItem";
import OutletInventoryModel, {
  type IOutletInventory,
} from "@/models/OutletInventory";
import OutletStockTransactionModel from "@/models/OutletStockTransaction";
import ProductModel from "@/models/Product";
import SaleModel from "@/models/Sale";
import SaleLineModel from "@/models/SaleLine";
import CashShiftModel from "@/models/CashShift";

export const dynamic = "force-dynamic";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type CartLine = {
  menuItemId?: string;
  inventoryItemId?: string;
  qty?: number;
};

type StockDeduction = {
  source: "BODEGA" | "GROCERY";
  productId: string;
  qty: number;
  name: string;
  strict: boolean;
};

async function nextReceiptNumber(): Promise<string> {
  // MOB-YYYYMMDD-NNNN per Manila day. The unique index is the real guard;
  // we retry once on duplicate.
  const datePart = manilaDateString().replaceAll("-", "");
  const prefix = `MOB-${datePart}-`;
  const latest = await SaleModel.findOne({
    receiptNumber: { $regex: `^${prefix}` },
  })
    .sort({ receiptNumber: -1 })
    .select("receiptNumber")
    .lean<{ receiptNumber?: string }>();
  const last = latest
    ? Number(String(latest.receiptNumber).slice(prefix.length)) || 0
    : 0;
  return `${prefix}${String(last + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const { user, response } = await requireMobileAuth(req, [
    "sales.view",
    "sales.manage",
  ]);
  if (response) return response;
  if (!user.outlet) {
    return NextResponse.json(
      { success: false, message: "Your account is not assigned to an outlet." },
      { status: 400 },
    );
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") || 30), 1),
    500,
  );

  const sales = await SaleModel.find(mobileOutletSalesFilter(user.outlet.id))
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const saleIds = sales.map((sale) => sale._id);
  const lines = await SaleLineModel.find({ saleId: { $in: saleIds } })
    .sort({ createdAt: 1 })
    .lean();
  const inventoryIds = lines
    .map((line) =>
      /^OUTLET_INVENTORY:([a-f0-9]{24})$/i.exec(
        String(line.remarks || ""),
      )?.[1],
    )
    .filter((id): id is string => Boolean(id));
  const inventory = await OutletInventoryModel.find({
    _id: { $in: inventoryIds },
    outletId: user.outlet.id,
  }).lean();
  const inventoryById = new Map(
    inventory.map((item) => [item._id.toString(), item]),
  );
  const linesBySaleId = new Map<string, typeof lines>();
  for (const line of lines) {
    const saleId = line.saleId.toString();
    const existing = linesBySaleId.get(saleId) || [];
    existing.push(line);
    linesBySaleId.set(saleId, existing);
  }

  let total = 0;
  const data = sales.map((s) => {
    total += Number(s.totalAmount || 0);
    const items = (linesBySaleId.get(s._id.toString()) || []).map((line) => {
      const inventoryId = /^OUTLET_INVENTORY:([a-f0-9]{24})$/i.exec(
        String(line.remarks || ""),
      )?.[1];
      const menuItemId = /^MENU:([a-f0-9]{24})$/i.exec(
        String(line.remarks || ""),
      )?.[1];
      const inventoryItem = inventoryId
        ? inventoryById.get(inventoryId)
        : undefined;
      const cost = inventoryItem
        ? pricePerPiece(
            inventoryItem.buyingPrice,
            inventoryItem.productSource === "BODEGA"
              ? inventoryItem.packSize
              : 0,
          )
        : 0;
      return {
        productId:
          (inventoryId && `inventory:${inventoryId}`) ||
          menuItemId ||
          line.productId?.toString() ||
          line.bodegaProductId?.toString() ||
          line._id.toString(),
        productName: String(line.productName || "Sale item"),
        price: Number(line.price || 0),
        cost,
        qty: Number(line.qty || 0),
      };
    });
    return {
      id: s._id.toString(),
      receiptNumber: s.receiptNumber,
      totalAmount: Number(s.totalAmount || 0),
      totalQty: Number(s.totalQty || 0),
      paidAmount: Number(s.paidAmount || 0),
      saleDate: s.saleDate ? new Date(s.saleDate).toISOString() : undefined,
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : undefined,
      items,
    };
  });

  return NextResponse.json({
    success: true,
    data,
    summary: { count: data.length, total },
  });
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireMobileAuth(req, "sales.manage");
  if (response) return response;

  if (!user.outlet) {
    return NextResponse.json(
      { success: false, message: "Your account is not assigned to an outlet." },
      { status: 400 },
    );
  }

  await dbConnect();

  let body: { items?: CartLine[]; cashReceived?: number; remarks?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const cart = Array.isArray(body?.items) ? body.items : [];
  if (cart.length === 0) {
    return NextResponse.json(
      { success: false, message: "Cart is empty." },
      { status: 400 },
    );
  }
  const parsedCart: ParsedMobileCartLine[] = [];
  for (const item of cart) {
    const parsed = parseMobileCartLine(item);
    if (!parsed.ok) {
      return NextResponse.json(
        { success: false, message: parsed.message },
        { status: 400 },
      );
    }
    if (!isValidObjectId(parsed.line.itemId)) {
      return NextResponse.json(
        { success: false, message: "No valid items in cart." },
        { status: 400 },
      );
    }
    parsedCart.push(parsed.line);
  }

  const outlet = user.outlet;
  const outletId = outlet.id;
  const mongoSession = await mongoose.startSession();

  try {
    let result: any = null;

    // Find the cashier's currently open shift (if any) so we can tag the sale
    // to it. Selling without an open shift is still allowed (the tag is simply
    // omitted), but the app guides cashiers to open one first.
    const openShift = await CashShiftModel.findOne({
      cashierId: user.id,
      outletId,
      status: "OPEN",
    })
      .select("_id")
      .lean<{ _id: { toString: () => string } }>();
    const shiftTag = openShift ? ` SHIFT:${openShift._id.toString()}` : "";

    await mongoSession.withTransaction(async () => {
      // 1) Load both accepted cart-reference variants, always scoped to the
      // cashier's outlet. Existing menuItemId behavior stays unchanged.
      const menuIds = parsedCart
        .filter((line) => line.kind === "menu")
        .map((line) => line.itemId);
      const inventoryIds = parsedCart
        .filter((line) => line.kind === "inventory")
        .map((line) => line.itemId);
      // MongoDB transactions do not support parallel operations on one session.
      const menuItems = await OutletMenuItemModel.find({
        _id: { $in: menuIds },
        outletId,
        isActive: true,
      }).session(mongoSession);
      const directInventoryItems = await OutletInventoryModel.find({
        _id: { $in: inventoryIds },
        outletId,
        isActive: true,
      }).session(mongoSession);

      const menuById = new Map(
        menuItems.map((item) => [item._id.toString(), item]),
      );
      const inventoryById = new Map(
        directInventoryItems.map((item) => [item._id.toString(), item]),
      );
      const bodegaProductIds = directInventoryItems
        .filter((item) => item.productSource === "BODEGA")
        .map((item) => item.productId);
      const groceryProductIds = directInventoryItems
        .filter((item) => item.productSource === "GROCERY")
        .map((item) => item.productId);
      const bodegaProducts = await BodegaProductModel.find({
        _id: { $in: bodegaProductIds },
        isActive: true,
      })
        .select("_id buyingPrice sellingPrice")
        .session(mongoSession);
      const groceryProducts = await ProductModel.find({
        _id: { $in: groceryProductIds },
        isActive: true,
      })
        .select("_id buyingPrice unitPrice")
        .session(mongoSession);
      const catalogByKey = new Map<
        string,
        NonNullable<CatalogPriceRecord>
      >();
      for (const product of bodegaProducts) {
        catalogByKey.set(`BODEGA:${product._id.toString()}`, product);
      }
      for (const product of groceryProducts) {
        catalogByKey.set(`GROCERY:${product._id.toString()}`, product);
      }

      // 2) Build sale lines + accumulate stock deductions.
      const lines: any[] = [];
      const stockDeductions = new Map<string, StockDeduction>();
      let totalAmount = 0;
      let totalQty = 0;

      function addStockDeduction(deduction: StockDeduction) {
        const key = `${deduction.source}:${deduction.productId}`;
        const existing = stockDeductions.get(key);
        if (existing) {
          existing.qty += deduction.qty;
          existing.strict = existing.strict || deduction.strict;
        } else {
          stockDeductions.set(key, { ...deduction });
        }
      }

      for (const cartLine of parsedCart) {
        if (cartLine.kind === "inventory") {
          const inventory = inventoryById.get(cartLine.itemId);
          if (!inventory) {
            throw new ApiError(
              404,
              "An outlet inventory item was not found or is unavailable.",
            );
          }
          const catalogProduct = catalogByKey.get(
            `${inventory.productSource}:${inventory.productId.toString()}`,
          );
          const prepared = prepareDirectInventorySaleLine(
            inventory,
            catalogProduct ?? null,
            cartLine.qty,
          );
          if (!prepared.ok) throw new ApiError(400, prepared.message);

          lines.push(prepared.line);
          totalAmount += prepared.line.lineTotal;
          totalQty += cartLine.qty;
          addStockDeduction(prepared.deduction);
          continue;
        }

        const menu = menuById.get(cartLine.itemId);
        if (!menu)
          throw new ApiError(
            404,
            "A menu item was not found or is unavailable.",
          );

        const lineTotal = Number(menu.price) * cartLine.qty;
        totalAmount += lineTotal;
        totalQty += cartLine.qty;

        lines.push({
          source: "BODEGA",
          productName: menu.name,
          categoryName: menu.category,
          qty: cartLine.qty,
          price: Number(menu.price),
          lineTotal,
          stockUnit: "QTY",
          packSize: 1,
          stockPcsOut: cartLine.qty,
          remarks: `MENU:${menu._id.toString()}`,
        });

        // Accumulate component deductions across the whole cart.
        for (const comp of menu.components || []) {
          const per = Number(comp.qtyPerSale || 0);
          if (per <= 0) continue;
          addStockDeduction({
            source: comp.productSource,
            productId: comp.productId.toString(),
            qty: per * cartLine.qty,
            name: comp.productName || "",
            strict: false,
          });
        }
      }

      const tender = validateMobileSaleTender(
        body.cashReceived,
        totalAmount,
        inventoryIds.length > 0,
      );
      if (!tender.ok) throw new ApiError(400, tender.message);

      const outletPaymentCustomer = await ensureMongooseOutletPaymentCustomer({
        outlet,
        createdBy: user.id,
      });

      // 3) Create the sale.
      let receiptNumber = await nextReceiptNumber();
      let sale;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const [created] = await (SaleModel as any).create(
            [
              {
                receiptNumber,
                customerId: outletPaymentCustomer.id,
                saleDate: new Date(),
                source: saleSourceForLines(lines.map((line) => line.source)),
                totalAmount,
                paidAmount: totalAmount, // cash, fully paid
                balance: 0,
                totalQty,
                status: "PAID",
                remarks: `MOBILE SALE OUTLET:${outletId}${shiftTag}`,
                createdBy: user.id,
              },
            ],
            { session: mongoSession },
          );
          sale = created;
          break;
        } catch (e: any) {
          if (e?.code === 11000 && attempt === 0) {
            receiptNumber = await nextReceiptNumber();
            continue;
          }
          throw e;
        }
      }
      if (!sale)
        throw new ApiError(
          500,
          "Could not generate a receipt number. Try again.",
        );

      await (SaleLineModel as any).insertMany(
        lines.map((l) => ({ ...l, saleId: sale._id })),
        { session: mongoSession },
      );

      // 4) Deduct outlet stock. Direct inventory lines are stock-guarded;
      //    existing menu-component lines retain their shortfall warning.
      const warnings: string[] = [];
      for (const dec of stockDeductions.values()) {
        let inv: IOutletInventory | null;
        let before: number;
        let after: number;
        if (dec.strict) {
          inv = await OutletInventoryModel.findOneAndUpdate(
            {
              outletId,
              productSource: dec.source,
              productId: dec.productId,
              isActive: true,
              stockQty: { $gte: dec.qty },
            },
            { $inc: { stockQty: -dec.qty } },
            { new: true, session: mongoSession },
          );
          if (!inv) {
            throw new ApiError(
              409,
              `Not enough stock for ${dec.name || "this item"}. Refresh and try again.`,
            );
          }
          after = Number(inv.stockQty || 0);
          before = after + dec.qty;
        } else {
          inv = await OutletInventoryModel.findOne({
            outletId,
            productSource: dec.source,
            productId: dec.productId,
            isActive: true,
          }).session(mongoSession);

          if (!inv) {
            warnings.push(
              `${dec.name || "An ingredient"} is not stocked at this outlet.`,
            );
            continue;
          }

          before = Number(inv.stockQty || 0);
          after = before - dec.qty;
          if (after < 0) {
            warnings.push(
              `${inv.productName}: sold ${dec.qty} but only ${before} in stock (now ${after}).`,
            );
          }

          inv.stockQty = after; // preserve menu-component shortfall behavior
          await inv.save({ session: mongoSession });
        }

        await (OutletStockTransactionModel as any).create(
          [
            {
              outletId,
              outletInventoryId: inv._id,
              productSource: dec.source,
              productId: dec.productId,
              productName: inv.productName,
              transactionDate: new Date(),
              type: "SALE",
              quantity: dec.qty,
              previousStock: before,
              newStock: after,
              referenceType: "MOBILE_SALE",
              referenceId: sale._id,
              sourceChannel: "FLUTTER",
              remarks: `SALE ${receiptNumber}`,
              createdBy: user.id,
            },
          ],
          { session: mongoSession },
        );
      }

      result = {
        id: sale._id.toString(),
        receiptNumber,
        totalAmount,
        totalQty,
        cashReceived: tender.cashReceived,
        change: tender.change,
        warnings,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Sale recorded.",
      sale: result,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Unable to record the sale." },
      { status: 500 },
    );
  } finally {
    await mongoSession.endSession();
  }
}

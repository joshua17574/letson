// app/api/mobile/sales/route.ts
//
// Records a cash sale from the mobile cashier. The cart is a list of menu
// items + quantities. We total it, create the Sale (+ lines), and deduct any
// mapped raw stock from outlet inventory — all in one transaction.
//
// Cash only, walk-in by default (no customer). Out-of-stock components do NOT
// block the sale (a POS shouldn't freeze at the counter); the shortfall is
// recorded and returned as a warning.

import { NextRequest, NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { manilaDateString } from "@/lib/date-utils";
import OutletMenuItemModel from "@/models/OutletMenuItem";
import OutletInventoryModel from "@/models/OutletInventory";
import OutletStockTransactionModel from "@/models/OutletStockTransaction";
import SaleModel from "@/models/Sale";
import SaleLineModel from "@/models/SaleLine";
import CashShiftModel from "@/models/CashShift";

export const dynamic = "force-dynamic";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type CartLine = { menuItemId?: string; qty?: number };

async function nextReceiptNumber(): Promise<string> {
  // MOB-YYYYMMDD-NNNN per Manila day. The unique index is the real guard;
  // we retry once on duplicate.
  const datePart = manilaDateString().replaceAll("-", "");
  const prefix = `MOB-${datePart}-`;
  const latest = await SaleModel.findOne({ receiptNumber: { $regex: `^${prefix}` } })
    .sort({ receiptNumber: -1 })
    .select("receiptNumber")
    .lean<{ receiptNumber?: string }>();
  const last = latest ? Number(String(latest.receiptNumber).slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(last + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const { user, response } = await requireMobileAuth(req, ["sales.view", "sales.manage"]);
  if (response) return response;
  if (!user.outlet) {
    return NextResponse.json(
      { success: false, message: "Your account is not assigned to an outlet." },
      { status: 400 }
    );
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 30), 1), 100);

  // Today's mobile sales for this outlet (by receipt prefix + remarks tag).
  const datePart = manilaDateString().replaceAll("-", "");
  const sales = await SaleModel.find({
    receiptNumber: { $regex: `^MOB-${datePart}-` },
    remarks: { $regex: `OUTLET:${user.outlet.id}` },
    isVoided: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  let total = 0;
  const data = (sales as any[]).map((s) => {
    total += Number(s.totalAmount || 0);
    return {
      id: s._id.toString(),
      receiptNumber: s.receiptNumber,
      totalAmount: Number(s.totalAmount || 0),
      totalQty: Number(s.totalQty || 0),
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : undefined,
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
      { status: 400 }
    );
  }

  await dbConnect();

  let body: { items?: CartLine[]; cashReceived?: number; remarks?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 });
  }

  const cart = Array.isArray(body?.items) ? body.items : [];
  if (cart.length === 0) {
    return NextResponse.json({ success: false, message: "Cart is empty." }, { status: 400 });
  }

  const outletId = user.outlet.id;
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
      // 1) Load the menu items in the cart (scoped to this outlet).
      const ids = cart
        .map((c) => String(c.menuItemId || ""))
        .filter((id) => isValidObjectId(id));

      if (ids.length === 0) throw new ApiError(400, "No valid items in cart.");

      const menuItems = await OutletMenuItemModel.find({
        _id: { $in: ids },
        outletId,
        isActive: true,
      }).session(mongoSession);

      const menuById = new Map(menuItems.map((m) => [m._id.toString(), m]));

      // 2) Build sale lines + accumulate stock deductions.
      const lines: any[] = [];
      const stockDeductions = new Map<string, { source: string; productId: string; qty: number; name: string }>();
      let totalAmount = 0;
      let totalQty = 0;

      for (const c of cart) {
        const menu = menuById.get(String(c.menuItemId));
        if (!menu) throw new ApiError(404, "A menu item was not found or is unavailable.");

        const qty = Math.trunc(Number(c.qty || 0));
        if (!Number.isFinite(qty) || qty < 1) {
          throw new ApiError(400, `Invalid quantity for ${menu.name}.`);
        }

        const lineTotal = Number(menu.price) * qty;
        totalAmount += lineTotal;
        totalQty += qty;

        lines.push({
          source: "BODEGA",
          productName: menu.name,
          categoryName: menu.category,
          qty,
          price: Number(menu.price),
          lineTotal,
          stockUnit: "QTY",
          packSize: 1,
          stockPcsOut: qty,
          remarks: `MENU:${menu._id.toString()}`,
        });

        // Accumulate component deductions across the whole cart.
        for (const comp of menu.components || []) {
          const per = Number(comp.qtyPerSale || 0);
          if (per <= 0) continue;
          const key = `${comp.productSource}:${comp.productId.toString()}`;
          const existing = stockDeductions.get(key);
          const add = per * qty;
          if (existing) existing.qty += add;
          else
            stockDeductions.set(key, {
              source: comp.productSource,
              productId: comp.productId.toString(),
              qty: add,
              name: comp.productName || "",
            });
        }
      }

      // 3) Create the sale.
      let receiptNumber = await nextReceiptNumber();
      let sale;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const [created] = await (SaleModel as any).create(
            [
              {
                receiptNumber,
                saleDate: new Date(),
                source: "BODEGA",
                totalAmount,
                paidAmount: totalAmount, // cash, fully paid
                balance: 0,
                totalQty,
                status: "PAID",
                remarks: `MOBILE SALE OUTLET:${outletId}${shiftTag}`,
                createdBy: user.id,
              },
            ],
            { session: mongoSession }
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
      if (!sale) throw new ApiError(500, "Could not generate a receipt number. Try again.");

      await (SaleLineModel as any).insertMany(
        lines.map((l) => ({ ...l, saleId: sale._id })),
        { session: mongoSession }
      );

      // 4) Deduct mapped raw stock from outlet inventory. Does NOT block on
      //    insufficient stock — records the shortfall and continues.
      const warnings: string[] = [];
      for (const dec of stockDeductions.values()) {
        const inv = await OutletInventoryModel.findOne({
          outletId,
          productSource: dec.source as "BODEGA" | "GROCERY",
          productId: dec.productId,
          isActive: true,
        }).session(mongoSession);

        if (!inv) {
          warnings.push(`${dec.name || "An ingredient"} is not stocked at this outlet.`);
          continue;
        }

        const before = Number(inv.stockQty || 0);
        const after = before - dec.qty;
        if (after < 0) {
          warnings.push(
            `${inv.productName}: sold ${dec.qty} but only ${before} in stock (now ${after}).`
          );
        }

        inv.stockQty = after; // allow negative to reflect reality; warned above
        await inv.save({ session: mongoSession });

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
          { session: mongoSession }
        );
      }

      const cashReceived = Number(body?.cashReceived || 0);
      result = {
        id: sale._id.toString(),
        receiptNumber,
        totalAmount,
        totalQty,
        cashReceived: cashReceived > 0 ? cashReceived : totalAmount,
        change: cashReceived > totalAmount ? cashReceived - totalAmount : 0,
        warnings,
      };
    });

    return NextResponse.json({ success: true, message: "Sale recorded.", sale: result });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ success: false, message: "Unable to record the sale." }, { status: 500 });
  } finally {
    await mongoSession.endSession();
  }
}

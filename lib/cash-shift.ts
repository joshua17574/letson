// lib/cash-shift.ts
import SaleModel from "@/models/Sale";
import ExpenseModel from "@/models/Expense";

/** Sum the (non-voided) sales tagged to a given shift id via remarks. */
export async function sumShiftSales(shiftId: string) {
  const sales = await SaleModel.find({
    remarks: { $regex: `SHIFT:${shiftId}` },
    isVoided: { $ne: true },
  })
    .select("totalAmount")
    .lean();

  let total = 0;
  for (const s of sales as Array<{ totalAmount?: number }>) {
    total += Number(s.totalAmount || 0);
  }
  return { total, count: sales.length };
}

/** Sum the active expenses tagged to a given shift id via remarks. */
export async function sumShiftExpenses(shiftId: string) {
  const expenses = await ExpenseModel.find({
    isActive: true,
    remarks: { $regex: `SHIFT:${shiftId}` },
  })
    .select("amount")
    .lean();

  let total = 0;
  for (const e of expenses as Array<{ amount?: number }>) {
    total += Number(e.amount || 0);
  }
  return { total, count: expenses.length };
}

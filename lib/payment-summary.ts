type PaymentPositionInput = {
  sales: number;
  immediateCashSales: number;
  recordedPayments: number;
};

type SaleUnitsInput = {
  totalPacks?: number | null;
  totalQty?: number | null;
  lines?: SaleUnitLineInput[] | null;
};

type SaleUnitLineInput = {
  stockUnit?: string | null;
  qty?: number | null;
  packSize?: number | null;
  stockPcsOut?: number | null;
};

function nonNegativeNumber(value: unknown) {
  return Math.max(0, Number(value) || 0);
}

function saleLineUnits(line: SaleUnitLineInput) {
  const qty = nonNegativeNumber(line.qty);
  const packSize = nonNegativeNumber(line.packSize);
  const stockPcsOut = nonNegativeNumber(line.stockPcsOut);
  const isPack = line.stockUnit === "PACK";

  return {
    packs: isPack ? qty : 0,
    pcs: isPack && packSize > 0 ? qty * packSize : stockPcsOut || qty,
  };
}

/**
 * Uses sale lines as the authoritative unit source. Header totals remain a
 * fallback for older imported sales that have no lines.
 */
export function saleUnits(input: SaleUnitsInput) {
  if (input.lines?.length) {
    return input.lines.reduce(
      (sum, line) => {
        const units = saleLineUnits(line);

        return {
          packs: sum.packs + units.packs,
          pcs: sum.pcs + units.pcs,
        };
      },
      { packs: 0, pcs: 0 },
    );
  }

  return {
    packs: nonNegativeNumber(input.totalPacks),
    pcs: nonNegativeNumber(input.totalQty),
  };
}

/** MongoDB accumulators equivalent to saleUnits' per-line rules. */
export function saleLineUnitGroupFields() {
  const qty = { $ifNull: ["$qty", 0] };
  const packSize = { $ifNull: ["$packSize", 0] };
  const stockPcsOut = { $ifNull: ["$stockPcsOut", 0] };
  const isPack = { $eq: ["$stockUnit", "PACK"] };
  const loosePieces = {
    $cond: [{ $gt: [stockPcsOut, 0] }, stockPcsOut, qty],
  };

  return {
    packs: {
      $sum: {
        $cond: [isPack, qty, 0],
      },
    },
    pcs: {
      $sum: {
        $cond: [
          { $and: [isPack, { $gt: [packSize, 0] }] },
          { $multiply: [qty, packSize] },
          loosePieces,
        ],
      },
    },
  };
}

/**
 * Mobile POS sales settle immediately and do not create Payment rows. All
 * other collections are represented by Payment.amount, so these sources can
 * be added without double-counting an allocation.
 */
export function paymentPosition(input: PaymentPositionInput) {
  const sales = Number(input.sales || 0);
  const paid =
    Number(input.immediateCashSales || 0) + Number(input.recordedPayments || 0);

  return {
    sales,
    paid,
    balance: sales - paid,
  };
}

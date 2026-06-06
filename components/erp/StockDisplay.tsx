"use client";

import { Badge } from "@/components/ui/badge";

export function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function wholeNumber(value: unknown) {
  return Math.max(0, Math.trunc(numberValue(value)));
}

export function formatWholeNumber(value: unknown) {
  return wholeNumber(value).toLocaleString();
}

export function formatDecimal(value: unknown, maximumFractionDigits = 2) {
  return numberValue(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export function getPackBreakdown(stockPcsValue: unknown, packSizeValue: unknown) {
  const stockPcs = wholeNumber(stockPcsValue);
  const packSize = wholeNumber(packSizeValue);

  if (packSize <= 0) {
    return {
      stockPcs,
      packSize: 0,
      packs: 0,
      loosePcs: stockPcs,
      isPackProduct: false,
    };
  }

  const packs = Math.floor(stockPcs / packSize);
  const loosePcs = stockPcs - packs * packSize;

  return {
    stockPcs,
    packSize,
    packs,
    loosePcs,
    isPackProduct: true,
  };
}

export function PackStockDisplay({
  stockPcs,
  packSize,
  fallbackUnit = "pcs",
  compact = false,
}: {
  stockPcs: unknown;
  packSize?: unknown;
  fallbackUnit?: string;
  compact?: boolean;
}) {
  const breakdown = getPackBreakdown(stockPcs, packSize);

  if (!breakdown.isPackProduct) {
    return (
      <div className="space-y-1">
        <div className="text-sm font-black text-slate-950">
          {formatWholeNumber(breakdown.stockPcs)} {fallbackUnit}
        </div>
        {!compact ? <div className="text-xs text-slate-500">Total stock</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="rounded-full bg-slate-950 text-white hover:bg-slate-950">
          {formatWholeNumber(breakdown.packs)} packs
        </Badge>
        <Badge variant="secondary" className="rounded-full">
          {formatWholeNumber(breakdown.loosePcs)} pcs loose
        </Badge>
      </div>
      {!compact ? (
        <div className="text-xs text-slate-500">
          {formatWholeNumber(breakdown.stockPcs)} pcs total • {formatWholeNumber(breakdown.packSize)} pcs/pack
        </div>
      ) : null}
    </div>
  );
}

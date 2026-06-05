"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPeso } from "@/lib/utils";

type BodegaMovementRow = {
  _id: string;
  product: string;
  stockIn: number;
  stockOut: number;
  currentStock: number;
  price: number;
  pricePerPack?: number;
  pricePerPcs?: number;
  stockUnit?: "PACK_PCS" | "UNIT";
  isPackProduct?: boolean;
  packSize?: number;
  stockInPacks?: number;
  stockInLoosePcs?: number;
  stockOutPacks?: number;
  stockOutLoosePcs?: number;
  currentPacks?: number;
  currentLoosePcs?: number;
  dateAdded?: string;
};

type PackBucket = {
  packSize: number;
  stockInPcs: number;
  stockOutPcs: number;
  currentPcs: number;
};

export function BodegaStockMovementPageClient() {
  const [rows, setRows] = useState<BodegaMovementRow[]>([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    dateFrom: "",
    dateTo: "",
  });
  const [isLoading, setIsLoading] = useState(true);

  async function loadData() {
    setIsLoading(true);

    const params = new URLSearchParams();

    if (appliedFilters.search) {
      params.set("search", appliedFilters.search);
    }

    if (appliedFilters.dateFrom) {
      params.set("dateFrom", appliedFilters.dateFrom);
    }

    if (appliedFilters.dateTo) {
      params.set("dateTo", appliedFilters.dateTo);
    }

    try {
      const res = await fetch(`/api/inventory/bodega?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load bodega stock movement.");
      }

      setRows(json.data || []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load bodega stock movement."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

  const professionalTotals = useMemo(() => {
    const packBucketMap = new Map<number, PackBucket>();

    const totals = {
      slicedStockInPcs: 0,
      slicedStockOutPcs: 0,
      slicedCurrentPcs: 0,
      unitStockIn: 0,
      unitStockOut: 0,
      unitCurrentStock: 0,
    };

    for (const row of rows) {
      const isPackProduct = Boolean(row.isPackProduct && Number(row.packSize || 0) > 0);

      if (isPackProduct) {
        const packSize = Number(row.packSize || 0);
        const currentBucket = packBucketMap.get(packSize) || {
          packSize,
          stockInPcs: 0,
          stockOutPcs: 0,
          currentPcs: 0,
        };

        currentBucket.stockInPcs += Number(row.stockIn || 0);
        currentBucket.stockOutPcs += Number(row.stockOut || 0);
        currentBucket.currentPcs += Number(row.currentStock || 0);

        packBucketMap.set(packSize, currentBucket);

        totals.slicedStockInPcs += Number(row.stockIn || 0);
        totals.slicedStockOutPcs += Number(row.stockOut || 0);
        totals.slicedCurrentPcs += Number(row.currentStock || 0);
      } else {
        totals.unitStockIn += Number(row.stockIn || 0);
        totals.unitStockOut += Number(row.stockOut || 0);
        totals.unitCurrentStock += Number(row.currentStock || 0);
      }
    }

    return {
      ...totals,
      packBuckets: Array.from(packBucketMap.values()).sort(
        (a, b) => a.packSize - b.packSize
      ),
    };
  }, [rows]);

  function applyFilters() {
    setAppliedFilters({
      search: search.trim(),
      dateFrom,
      dateTo,
    });
  }

  function resetFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setAppliedFilters({
      search: "",
      dateFrom: "",
      dateTo: "",
    });
  }

  function refreshData() {
    void loadData();
  }

  function formatNumber(value: number, decimals = 2) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function formatWholeNumber(value: number | undefined) {
    return Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });
  }

  function formatDate(value?: string) {
    if (!value) return "-";
    return new Date(value).toISOString().slice(0, 10);
  }

  function getBreakdown(totalPcsValue: number | undefined, packSizeValue: number | undefined) {
    const totalPcs = Math.max(0, Math.trunc(Number(totalPcsValue || 0)));
    const packSize = Math.max(0, Math.trunc(Number(packSizeValue || 0)));

    if (packSize <= 0) {
      return {
        packs: 0,
        loosePcs: totalPcs,
      };
    }

    const packs = Math.floor(totalPcs / packSize);

    return {
      packs,
      loosePcs: totalPcs - packs * packSize,
    };
  }

  function renderPackQuantity(totalPcs: number, packSize: number) {
    const breakdown = getBreakdown(totalPcs, packSize);
    const hasLoose = breakdown.loosePcs > 0;

    return (
      <div className="space-y-0.5 text-right">
        <div className="font-semibold text-slate-950">
          {formatWholeNumber(breakdown.packs)} pack
          {breakdown.packs === 1 ? "" : "s"}
          {hasLoose ? ` / ${formatWholeNumber(breakdown.loosePcs)} pcs` : ""}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatWholeNumber(totalPcs)} pcs total
        </div>
      </div>
    );
  }

  function renderStockQuantity(
    row: BodegaMovementRow,
    baseQty: number,
    packs?: number,
    loosePcs?: number
  ) {
    if (!row.isPackProduct || !row.packSize) {
      return (
        <div className="text-right">
          <div className="font-medium text-slate-950">
            {formatNumber(baseQty)}
          </div>
          <div className="text-xs text-muted-foreground">heads / units</div>
        </div>
      );
    }

    const packText = `${formatWholeNumber(packs)} pack${Number(packs || 0) === 1 ? "" : "s"}`;
    const looseText = Number(loosePcs || 0) > 0 ? ` / ${formatWholeNumber(loosePcs)} pcs` : "";

    return (
      <div className="space-y-0.5 text-right">
        <div className="font-semibold text-slate-950">
          {packText}
          {looseText}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatWholeNumber(baseQty)} pcs total
        </div>
      </div>
    );
  }

  function renderSlicedSummaryColumn(kind: "stockInPcs" | "stockOutPcs" | "currentPcs") {
    const total = professionalTotals.packBuckets.reduce(
      (sum, bucket) => sum + bucket[kind],
      0
    );

    if (total <= 0) {
      return (
        <div className="text-right">
          <div className="font-semibold">0 pcs</div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {professionalTotals.packBuckets.map((bucket) => (
          <div key={`${bucket.packSize}-${kind}`}>{renderPackQuantity(bucket[kind], bucket.packSize)}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Bodega Stock Movement Inventory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sliced products are shown by packs and loose pcs. Whole chicken is shown separately so totals do not mix different units.
          </p>
        </div>

        <Button onClick={refreshData}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[2fr_1.5fr_1.5fr_auto_auto]">
        <div className="space-y-2">
          <Label>Search Product</Label>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="e.g. C10, OS1, SUPOT #1"
            onKeyDown={(event) => {
              if (event.key === "Enter") applyFilters();
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>End Date</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>

        <div className="flex items-end">
          <Button variant="outline" onClick={applyFilters}>
            <Search className="mr-2 h-4 w-4" />
            Filter
          </Button>
        </div>

        <div className="flex items-end">
          <Button variant="secondary" onClick={resetFilters}>
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sliced Product Current Stock
            </p>
            <div className="mt-2 space-y-1">
              {professionalTotals.packBuckets.length > 0 ? (
                professionalTotals.packBuckets.map((bucket) => (
                  <div key={`summary-current-${bucket.packSize}`} className="flex items-start justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {bucket.packSize} pcs / pack
                    </span>
                    {renderPackQuantity(bucket.currentPcs, bucket.packSize)}
                  </div>
                ))
              ) : (
                <p className="text-lg font-semibold">0 pcs</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Whole Chicken / Other Current Stock
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {formatNumber(professionalTotals.unitCurrentStock)}
            </p>
            <p className="text-xs text-muted-foreground">heads / units</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Records Shown
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {rows.length.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              Totals are separated by unit type.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Stock In</TableHead>
                  <TableHead className="text-right">Stock Out</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No bodega stock movement records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => (
                    <TableRow key={row._id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        <div>{row.product}</div>
                        {row.isPackProduct && row.packSize ? (
                          <div className="text-xs text-muted-foreground">
                            Pack product - {formatWholeNumber(row.packSize)} pcs / pack
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Whole chicken / unit product
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderStockQuantity(
                          row,
                          row.stockIn,
                          row.stockInPacks,
                          row.stockInLoosePcs
                        )}
                      </TableCell>
                      <TableCell>
                        {renderStockQuantity(
                          row,
                          row.stockOut,
                          row.stockOutPacks,
                          row.stockOutLoosePcs
                        )}
                      </TableCell>
                      <TableCell>
                        {renderStockQuantity(
                          row,
                          row.currentStock,
                          row.currentPacks,
                          row.currentLoosePcs
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{formatPeso(row.price)}</div>
                        {row.isPackProduct && row.packSize ? (
                          <div className="text-xs text-muted-foreground">
                            per pack
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatDate(row.dateAdded)}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/inventory/bodega/${row._id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {!isLoading && rows.length > 0 ? (
                  <>
                    <TableRow className="bg-slate-50 align-top">
                      <TableCell colSpan={2} className="font-bold text-slate-950">
                        Total Sliced Products
                        <div className="text-xs font-normal text-muted-foreground">
                          Pack totals grouped by pack size; pcs total remains visible.
                        </div>
                      </TableCell>
                      <TableCell>{renderSlicedSummaryColumn("stockInPcs")}</TableCell>
                      <TableCell>{renderSlicedSummaryColumn("stockOutPcs")}</TableCell>
                      <TableCell>{renderSlicedSummaryColumn("currentPcs")}</TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>

                    <TableRow className="bg-slate-50">
                      <TableCell colSpan={2} className="font-bold text-slate-950">
                        Total Whole Chicken / Other Products
                        <div className="text-xs font-normal text-muted-foreground">
                          Kept separate from sliced pcs to avoid mixed-unit totals.
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatNumber(professionalTotals.unitStockIn)}
                        <div className="text-xs font-normal text-muted-foreground">
                          heads / units
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatNumber(professionalTotals.unitStockOut)}
                        <div className="text-xs font-normal text-muted-foreground">
                          heads / units
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatNumber(professionalTotals.unitCurrentStock)}
                        <div className="text-xs font-normal text-muted-foreground">
                          heads / units
                        </div>
                      </TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  </>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

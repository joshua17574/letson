"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  dateAdded?: string;
  isPackProduct?: boolean;
  packSize?: number;
  stockInPcs?: number;
  stockInPacks?: number;
  stockInLoosePcs?: number;
  stockOutPcs?: number;
  stockOutPacks?: number;
  stockOutLoosePcs?: number;
  currentStockPcs?: number;
  currentStockPacks?: number;
  currentStockLoosePcs?: number;
  pricePerPack?: number;
  pricePerPcs?: number;
};

type BodegaTotals = {
  raw?: {
    stockIn: number;
    stockOut: number;
    currentStock: number;
  };
  sliced?: {
    stockInPcs: number;
    stockOutPcs: number;
    currentPcs: number;
  };
  whole?: {
    stockIn: number;
    stockOut: number;
    currentStock: number;
  };
};

export function BodegaStockMovementPageClient() {
  const [rows, setRows] = useState<BodegaMovementRow[]>([]);
  const [totals, setTotals] = useState<BodegaTotals>({
    raw: { stockIn: 0, stockOut: 0, currentStock: 0 },
    sliced: { stockInPcs: 0, stockOutPcs: 0, currentPcs: 0 },
    whole: { stockIn: 0, stockOut: 0, currentStock: 0 },
  });
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
    if (appliedFilters.search) params.set("search", appliedFilters.search);
    if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
    if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);

    try {
      const res = await fetch(`/api/inventory/bodega?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load bodega stock movement.");
      }

      setRows(json.data || []);
      setTotals(
        json.totals || {
          raw: { stockIn: 0, stockOut: 0, currentStock: 0 },
          sliced: { stockInPcs: 0, stockOutPcs: 0, currentPcs: 0 },
          whole: { stockIn: 0, stockOut: 0, currentStock: 0 },
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load bodega stock movement."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

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
    setAppliedFilters({ search: "", dateFrom: "", dateTo: "" });
  }

  function refreshData() {
    void loadData();
  }

  function formatNumber(value: number | undefined, decimals = 2) {
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

  function renderStockQuantity(
    row: BodegaMovementRow,
    baseQty: number,
    packs?: number,
    loosePcs?: number
  ) {
    if (!row.isPackProduct || !row.packSize) {
      return (
        <div className="text-right">
          <div className="font-semibold">{formatNumber(baseQty)}</div>
          <div className="text-xs text-muted-foreground">base units</div>
        </div>
      );
    }

    return (
      <div className="text-right leading-tight">
        <div className="font-semibold text-slate-950">
          {formatWholeNumber(packs)} pack{Number(packs || 0) === 1 ? "" : "s"}
          {Number(loosePcs || 0) > 0 ? ` / ${formatWholeNumber(loosePcs)} pcs` : ""}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatWholeNumber(baseQty)} pcs total
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bodega Stock Movement Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Sliced products are stored as total PCS and displayed as packs plus loose PCS.
          </p>
        </div>
        <Button variant="outline" onClick={refreshData}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-4">
          <div>
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

          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>

          <div>
            <Label>End Date</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>

          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} className="flex-1">
              <Search className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button variant="secondary" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Sliced Products Current</p>
            <p className="mt-1 text-2xl font-bold">
              {formatWholeNumber(totals.sliced?.currentPcs)} pcs
            </p>
            <p className="text-xs text-muted-foreground">
              Pack totals are shown per product because pack size can differ.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Whole / Other Current</p>
            <p className="mt-1 text-2xl font-bold">
              {formatNumber(totals.whole?.currentStock || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Heads or base units.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Inventory Rule</p>
            <p className="mt-1 text-sm font-semibold">PCS is the source of truth</p>
            <p className="text-xs text-muted-foreground">
              Example: 30 loose + 20 loose becomes 1 pack automatically when total PCS reaches pack size.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Stock In</TableHead>
                  <TableHead className="text-right">Stock Out</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Pack Size</TableHead>
                  <TableHead className="text-right">Price / PCS</TableHead>
                  <TableHead className="text-right">Price / Pack</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      No bodega stock movement records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => (
                    <TableRow key={row._id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{row.product}</TableCell>
                      <TableCell>
                        {renderStockQuantity(row, row.stockIn, row.stockInPacks, row.stockInLoosePcs)}
                      </TableCell>
                      <TableCell>
                        {renderStockQuantity(row, row.stockOut, row.stockOutPacks, row.stockOutLoosePcs)}
                      </TableCell>
                      <TableCell>
                        {renderStockQuantity(
                          row,
                          row.currentStock,
                          row.currentStockPacks,
                          row.currentStockLoosePcs
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.isPackProduct && row.packSize
                          ? `${formatWholeNumber(row.packSize)} pcs / pack`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.isPackProduct ? formatPeso(row.pricePerPcs || 0) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.isPackProduct ? formatPeso(row.pricePerPack || 0) : formatPeso(row.price)}
                      </TableCell>
                      <TableCell>{formatDate(row.dateAdded)}</TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/inventory/bodega/${row._id}`}>
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {!isLoading && rows.length > 0 ? (
                  <>
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell colSpan={2}>Total Sliced Products</TableCell>
                      <TableCell className="text-right">
                        {formatWholeNumber(totals.sliced?.stockInPcs)} pcs
                      </TableCell>
                      <TableCell className="text-right">
                        {formatWholeNumber(totals.sliced?.stockOutPcs)} pcs
                      </TableCell>
                      <TableCell className="text-right">
                        {formatWholeNumber(totals.sliced?.currentPcs)} pcs
                      </TableCell>
                      <TableCell colSpan={5} className="text-xs text-muted-foreground">
                        Pack count is displayed per product because each product can use a different pack size.
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell colSpan={2}>Total Whole / Other Products</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(totals.whole?.stockIn || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(totals.whole?.stockOut || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(totals.whole?.currentStock || 0)}
                      </TableCell>
                      <TableCell colSpan={5} className="text-xs text-muted-foreground">
                        Whole chicken and other products remain in base units.
                      </TableCell>
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

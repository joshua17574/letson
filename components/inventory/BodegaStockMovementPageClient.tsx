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
  stockIn: number;
  stockOut: number;
  currentStock: number;
};

export function BodegaStockMovementPageClient() {
  const [rows, setRows] = useState<BodegaMovementRow[]>([]);
  const [totals, setTotals] = useState<BodegaTotals>({
    stockIn: 0,
    stockOut: 0,
    currentStock: 0,
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
      setTotals(
        json.totals || {
          stockIn: 0,
          stockOut: 0,
          currentStock: 0,
        }
      );
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
    if (!value) return "—";
    return new Date(value).toISOString().slice(0, 10);
  }

  function renderStockQuantity(
    row: BodegaMovementRow,
    baseQty: number,
    packs?: number,
    loosePcs?: number
  ) {
    if (!row.isPackProduct || !row.packSize) {
      return <span>{formatNumber(baseQty)}</span>;
    }

    const packText = `${formatWholeNumber(packs)} pack${Number(packs || 0) === 1 ? "" : "s"}`;
    const looseText = Number(loosePcs || 0) > 0 ? ` / ${formatWholeNumber(loosePcs)} pcs` : "";

    return (
      <div className="space-y-0.5">
        <div className="font-semibold">{packText}{looseText}</div>
        <div className="text-xs text-muted-foreground">
          {formatWholeNumber(baseQty)} pcs total
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Bodega Stock Movement Inventory
        </h1>

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
            placeholder="e.g. C10, ISOL, SUPOT #1"
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

      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Stock In</TableHead>
                  <TableHead>Stock Out</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Pack Size</TableHead>
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
                    <TableCell
                      colSpan={10}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No bodega stock movement records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => (
                    <TableRow key={row._id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{row.product}</TableCell>
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
                          row.currentStockPacks,
                          row.currentStockLoosePcs
                        )}
                      </TableCell>
                      <TableCell>
                        {row.isPackProduct && row.packSize
                          ? `${formatWholeNumber(row.packSize)} pcs / pack`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.isPackProduct ? formatPeso(row.pricePerPcs || 0) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.isPackProduct ? formatPeso(row.pricePerPack || 0) : formatPeso(row.price)}
                      </TableCell>
                      <TableCell>{formatDate(row.dateAdded)}</TableCell>
                      <TableCell className="text-center">
                        <Button asChild variant="outline" size="sm">
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
                  <TableRow className="font-semibold">
                    <TableCell colSpan={2} className="text-center">
                      Total
                    </TableCell>
                    <TableCell>{formatNumber(totals.stockIn)}</TableCell>
                    <TableCell>{formatNumber(totals.stockOut)}</TableCell>
                    <TableCell>{formatNumber(totals.currentStock)}</TableCell>
                    <TableCell colSpan={5} className="text-xs text-muted-foreground">
                      Totals are raw base quantities. Pack counts are shown per product because each product can have a different pack size.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

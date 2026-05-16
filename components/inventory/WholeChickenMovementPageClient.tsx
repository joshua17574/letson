"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Loader2, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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

type MovementRow = {
  _id: string;
  product: string;
  inPcs: number;
  inBags: number;
  inKilos: number;
  outQty: number;
  currentPcs: number;
  currentBags: number;
  currentKilos: number;
  updated?: string;
};

type MovementTotals = {
  inPcs: number;
  inBags: number;
  inKilos: number;
  outQty: number;
  currentPcs: number;
};

export function WholeChickenMovementPageClient() {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [totals, setTotals] = useState<MovementTotals>({
    inPcs: 0,
    inBags: 0,
    inKilos: 0,
    outQty: 0,
    currentPcs: 0,
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
      const res = await fetch(
        `/api/inventory/whole-chicken?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load inventory movement.");
      }

      setRows(json.data || []);
      setTotals(
        json.totals || {
          inPcs: 0,
          inBags: 0,
          inKilos: 0,
          outQty: 0,
          currentPcs: 0,
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load inventory movement."
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

  function formatDate(value?: string) {
    if (!value) return "—";
    return new Date(value).toISOString().slice(0, 10);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Stock Movement Inventory
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
            placeholder="e.g. C1-PS, OS1, US"
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
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">In Pcs</TableHead>
                  <TableHead className="text-right">In Bags</TableHead>
                  <TableHead className="text-right">In Kilos</TableHead>
                  <TableHead className="text-right">Out Qty</TableHead>
                  <TableHead className="text-right">Current Pcs</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No stock movement records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => (
                    <TableRow key={row._id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{row.product}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.inPcs)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.inBags)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.inKilos)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.outQty)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.currentPcs)}
                      </TableCell>
                      <TableCell>{formatDate(row.updated)}</TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/inventory/whole-chicken/${row._id}`}>
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {!isLoading && rows.length > 0 ? (
                  <TableRow className="font-bold">
                    <TableCell colSpan={2} className="text-right">
                      Total
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(totals.inPcs)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(totals.inBags)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(totals.inKilos)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(totals.outQty)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(totals.currentPcs)}
                    </TableCell>
                    <TableCell />
                    <TableCell />
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
"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProductOption = {
  _id: string;
  name: string;
};

type DailyProductBreakdown = {
  mainProductName: string;
  slicedProductName: string;
  standardPacking: number;
  bags: number;
  heads: number;
  kilos: number;
  totalStdPcs: number;
  actualSlicedPcs: number;
  actualPacks: number;
  butal: number;
  variance: number;
  activityCount: number;
};

type DailySlicingRecord = {
  _id: string;
  date: string;
  slicingDate?: string;
  transactionName: string;
  mainProductName: string;
  slicedProductName: string;
  batchCount: number;
  activityCount: number;
  bags: number;
  heads: number;
  kilos: number;
  totalStdPcs: number;
  actualSlicedPcs: number;
  actualPacks: number;
  butal: number;
  variance: number;
  slicers: string[];
  packers: string[];
  products: DailyProductBreakdown[];
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type DailySummary = {
  dayCount: number;
  batchCount: number;
  activityCount: number;
  heads: number;
  kilos: number;
  totalStdPcs: number;
  actualSlicedPcs: number;
  actualPacks: number;
  butal: number;
  variance: number;
};

const emptySummary: DailySummary = {
  dayCount: 0,
  batchCount: 0,
  activityCount: 0,
  heads: 0,
  kilos: 0,
  totalStdPcs: 0,
  actualSlicedPcs: 0,
  actualPacks: 0,
  butal: 0,
  variance: 0,
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown, decimals = 0) {
  return numberValue(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function formatPeople(values: string[]) {
  if (!values || values.length === 0) return "-";
  if (values.length <= 2) return values.join(", ");
  return `${values.slice(0, 2).join(", ")} +${values.length - 2}`;
}

function formatPacks(packs: number, loosePcs: number) {
  const packText = `${formatNumber(packs)} ${numberValue(packs) === 1 ? "pack" : "packs"}`;
  const looseText = `${formatNumber(loosePcs)} pcs`;
  return `${packText} / ${looseText}`;
}

export function SliceHistoryPageClient() {
  const [records, setRecords] = useState<DailySlicingRecord[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [summary, setSummary] = useState<DailySummary>(emptySummary);
  const [meta, setMeta] = useState<ApiMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState("50");
  const [slicedProductId, setSlicedProductId] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    slicedProductId: "ALL",
    dateFrom: "",
    dateTo: "",
  });
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const rangeLabel = useMemo(() => {
    if (appliedFilters.dateFrom && appliedFilters.dateTo) {
      return `${appliedFilters.dateFrom} to ${appliedFilters.dateTo}`;
    }
    if (appliedFilters.dateFrom) return `${appliedFilters.dateFrom} onwards`;
    if (appliedFilters.dateTo) return `Until ${appliedFilters.dateTo}`;
    return "All dates";
  }, [appliedFilters.dateFrom, appliedFilters.dateTo]);

  async function loadProducts() {
    try {
      const res = await fetch("/api/bodega-products?limit=1000", {
        cache: "no-store",
      });
      const json = await res.json();

      if (res.ok && json.success) {
        const data = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data?.items)
            ? json.data.items
            : [];
        setProducts(data);
      }
    } catch {
      toast.error("Failed to load sliced products.");
    }
  }

  async function loadRecords() {
    setIsLoading(true);

    const params = new URLSearchParams({
      groupBy: "daily",
      page: String(page),
      limit,
    });

    if (appliedFilters.slicedProductId !== "ALL") {
      params.set("slicedProductId", appliedFilters.slicedProductId);
    }

    if (appliedFilters.dateFrom) {
      params.set("dateFrom", appliedFilters.dateFrom);
    }

    if (appliedFilters.dateTo) {
      params.set("dateTo", appliedFilters.dateTo);
    }

    try {
      const res = await fetch(`/api/slicing?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load daily slicing history.");
      }

      setRecords(json.data || []);
      setSummary(json.summary || emptySummary);
      setMeta(
        json.meta || {
          page,
          limit: Number(limit),
          total: 0,
          totalPages: 1,
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load daily slicing history."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    void loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, appliedFilters]);

  function applyFilters() {
    setAppliedFilters({
      slicedProductId,
      dateFrom,
      dateTo,
    });
    setExpandedDate(null);
    setPage(1);
  }

  function resetFilters() {
    setSlicedProductId("ALL");
    setDateFrom("");
    setDateTo("");
    setAppliedFilters({
      slicedProductId: "ALL",
      dateFrom: "",
      dateTo: "",
    });
    setExpandedDate(null);
    setPage(1);
  }

  function printPage() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Daily Slicing History
          </h1>
          <p className="text-sm text-muted-foreground">
            One transaction row per day. All slicing activities for the same day are added together.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printPage}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button asChild>
            <Link href="/slicing/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Slicing
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Days
            </p>
            <p className="text-2xl font-bold">{formatNumber(summary.dayCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Activities
            </p>
            <p className="text-2xl font-bold">{formatNumber(summary.activityCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Heads
            </p>
            <p className="text-2xl font-bold">{formatNumber(summary.heads)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Kilos
            </p>
            <p className="text-2xl font-bold">{formatNumber(summary.kilos, 2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Std PCS
            </p>
            <p className="text-2xl font-bold">{formatNumber(summary.totalStdPcs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Actual PCS
            </p>
            <p className="text-2xl font-bold">{formatNumber(summary.actualSlicedPcs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Full Packs
            </p>
            <p className="text-2xl font-bold">{formatNumber(summary.actualPacks)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Loose PCS
            </p>
            <p className="text-2xl font-bold">{formatNumber(summary.butal)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <form
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[8rem_minmax(16rem,1.4fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto] xl:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="slice-history-limit">Show</Label>
              <Select
                value={limit}
                onValueChange={(value) => {
                  setLimit(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="slice-history-limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slice-history-product">Sliced Product</Label>
              <Select value={slicedProductId} onValueChange={setSlicedProductId}>
                <SelectTrigger id="slice-history-product">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slice-history-date-from">From</Label>
              <Input
                id="slice-history-date-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onInput={(event) => setDateFrom(event.currentTarget.value)}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slice-history-date-to">To</Label>
              <Input
                id="slice-history-date-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onInput={(event) => setDateTo(event.currentTarget.value)}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
              <Button type="submit" className="flex-1 xl:flex-none">
                <Search className="mr-2 h-4 w-4" />
                Filter
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={resetFilters}
                className="flex-1 xl:flex-none"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Daily Slicing Transactions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Filters: {rangeLabel} - Showing {records.length} of {meta.total} daily records
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader className="bg-slate-950">
                <TableRow>
                  <TableHead className="text-white">Date</TableHead>
                  <TableHead className="text-white">Activities</TableHead>
                  <TableHead className="text-white">Products</TableHead>
                  <TableHead className="text-right text-white">Heads</TableHead>
                  <TableHead className="text-right text-white">Kilos</TableHead>
                  <TableHead className="text-right text-white">Std PCS</TableHead>
                  <TableHead className="text-right text-white">Actual PCS</TableHead>
                  <TableHead className="text-right text-white">Packs / Loose</TableHead>
                  <TableHead className="text-right text-white">Variance</TableHead>
                  <TableHead className="text-white">Slicer / Packer</TableHead>
                  <TableHead className="text-center text-white">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                      No daily slicing transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => {
                    const expanded = expandedDate === record._id;

                    return (
                      <Fragment key={record._id}>
                        <TableRow key={record._id} className="align-top">
                          <TableCell className="font-semibold">
                            {formatDate(record.slicingDate || record.date)}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">
                              {formatNumber(record.activityCount)} items
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatNumber(record.batchCount)} batches
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">{record.slicedProductName}</div>
                            <div className="text-xs text-muted-foreground">
                              From {record.mainProductName}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatNumber(record.heads)}</TableCell>
                          <TableCell className="text-right">{formatNumber(record.kilos, 2)}</TableCell>
                          <TableCell className="text-right">{formatNumber(record.totalStdPcs)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatNumber(record.actualSlicedPcs)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-semibold">
                              {formatPacks(record.actualPacks, record.butal)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatNumber(record.actualSlicedPcs)} pcs total
                            </div>
                          </TableCell>
                          <TableCell
                            className={
                              record.variance < 0
                                ? "text-right font-semibold text-red-600"
                                : record.variance > 0
                                  ? "text-right font-semibold text-emerald-700"
                                  : "text-right"
                            }
                          >
                            {formatNumber(record.variance)}
                          </TableCell>
                          <TableCell>
                            <div>{formatPeople(record.slicers)}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatPeople(record.packers)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedDate(expanded ? null : record._id)}
                            >
                              {expanded ? (
                                <ChevronUp className="mr-1 h-4 w-4" />
                              ) : (
                                <ChevronDown className="mr-1 h-4 w-4" />
                              )}
                              View
                            </Button>
                          </TableCell>
                        </TableRow>

                        {expanded ? (
                          <TableRow key={`${record._id}-details`}>
                            <TableCell colSpan={11} className="bg-slate-50 p-4">
                              <div className="overflow-hidden rounded-xl border bg-white">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Main Product</TableHead>
                                      <TableHead>Sliced Product</TableHead>
                                      <TableHead className="text-right">Pack Size</TableHead>
                                      <TableHead className="text-right">Heads</TableHead>
                                      <TableHead className="text-right">Kilos</TableHead>
                                      <TableHead className="text-right">Std PCS</TableHead>
                                      <TableHead className="text-right">Actual PCS</TableHead>
                                      <TableHead className="text-right">Packs / Loose</TableHead>
                                      <TableHead className="text-right">Variance</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {record.products.map((product, index) => (
                                      <TableRow
                                        key={`${record._id}-${product.mainProductName}-${product.slicedProductName}-${index}`}
                                      >
                                        <TableCell>{product.mainProductName}</TableCell>
                                        <TableCell className="font-semibold">
                                          {product.slicedProductName}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatNumber(product.standardPacking)} pcs
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatNumber(product.heads)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatNumber(product.kilos, 2)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatNumber(product.totalStdPcs)}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                          {formatNumber(product.actualSlicedPcs)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatPacks(product.actualPacks, product.butal)}
                                        </TableCell>
                                        <TableCell
                                          className={
                                            product.variance < 0
                                              ? "text-right font-semibold text-red-600"
                                              : product.variance > 0
                                                ? "text-right font-semibold text-emerald-700"
                                                : "text-right"
                                          }
                                        >
                                          {formatNumber(product.variance)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {records.length} of {meta.total} daily records
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Previous
              </Button>
              <Button variant="outline" disabled>
                Page {meta.page} of {meta.totalPages}
              </Button>
              <Button
                variant="outline"
                disabled={page >= meta.totalPages || isLoading}
                onClick={() =>
                  setPage((current) => Math.min(current + 1, meta.totalPages))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Printer, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { ModuleHeader } from "@/components/app-shell/ModuleHeader";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatPeso } from "@/lib/utils";

type ProductOption = {
  _id: string;
  name: string;
};

type ReportRow = {
  _id: string;
  batchId: string;
  date: string;
  mainProductId: string;
  mainProductName: string;
  slicedProductId: string;
  slicedProductName: string;
  heads: number;
  kilos: number;
  deliveryPrice: number;
  standardSlice: number;
  standardPacking: number;
  standardPcs: number;
  actualPcs: number;
  actualPacks: number;
  loosePcs: number;
  variance: number;
  pricePerPcs: number;
  pricePerPack: number;
  capital: number;
  gross: number;
  profit: number;
  slicer: string;
  packer: string;
};

type ReportSummary = {
  totalRows: number;
  totalHeads: number;
  totalKilos: number;
  totalStandardPcs: number;
  totalActualPcs: number;
  totalPacks: number;
  totalLoosePcs: number;
  totalCapital: number;
  totalGross: number;
  totalProfit: number;
};

type ReportFilters = {
  mainProducts: ProductOption[];
  slicedProducts: ProductOption[];
};

type LoadParams = {
  dateFrom?: string;
  dateTo?: string;
  mainProductId?: string;
  slicedProductId?: string;
  search?: string;
  limit?: string;
};

const EMPTY_VALUE = "\u2014";
const filterLabelClass =
  "text-xs font-bold uppercase tracking-wide text-muted-foreground";

const emptySummary: ReportSummary = {
  totalRows: 0,
  totalHeads: 0,
  totalKilos: 0,
  totalStandardPcs: 0,
  totalActualPcs: 0,
  totalPacks: 0,
  totalLoosePcs: 0,
  totalCapital: 0,
  totalGross: 0,
  totalProfit: 0,
};

const numberFormatters = new Map<number, Intl.NumberFormat>();

function numberValue(value: string | number | undefined | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return formatPeso(numberValue(value));
}

function getNumberFormatter(fractionDigits: number) {
  const existing = numberFormatters.get(fractionDigits);

  if (existing) {
    return existing;
  }

  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  numberFormatters.set(fractionDigits, formatter);
  return formatter;
}

function formatNumber(value: number, fractionDigits = 0) {
  return getNumberFormatter(fractionDigits).format(numberValue(value));
}

function formatDate(value: string) {
  if (!value) return EMPTY_VALUE;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;

  return date.toISOString().slice(0, 10);
}

function profitTone(value: number) {
  return value < 0 ? "text-red-600" : "text-emerald-700";
}

function DetailLine({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("tabular-value font-semibold text-foreground", className)}>
        {value}
      </span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardContent className="p-5 text-center">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("tabular-value mt-2 text-2xl font-bold", className)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ReportMobileRow({ row }: { row: ReportRow }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            {formatDate(row.date)}
          </p>
          <p className="mt-1 text-base font-black text-foreground">
            {row.mainProductName || EMPTY_VALUE}
          </p>
          <p className="text-sm font-semibold text-muted-foreground">
            {row.slicedProductName || EMPTY_VALUE}
          </p>
        </div>
        <div
          className={cn(
            "tabular-value text-right text-lg font-black",
            profitTone(row.profit)
          )}
        >
          {formatMoney(row.profit)}
        </div>
      </div>

      <div className="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-2">
        <DetailLine label="Heads" value={formatNumber(row.heads)} />
        <DetailLine label="Kilos" value={formatNumber(row.kilos, 2)} />
        <DetailLine label="Actual PCS" value={formatNumber(row.actualPcs)} />
        <DetailLine
          label="Packs / Loose"
          value={`${formatNumber(row.actualPacks)} / ${formatNumber(row.loosePcs)}`}
        />
        <DetailLine label="Capital" value={formatMoney(row.capital)} />
        <DetailLine label="Total Amount" value={formatMoney(row.gross)} />
        <DetailLine label="Price / PCS" value={formatMoney(row.pricePerPcs)} />
        <DetailLine label="Price / Pack" value={formatMoney(row.pricePerPack)} />
      </div>

      <div className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Crew:</span>{" "}
        {row.slicer || EMPTY_VALUE}
        <span className="mx-2 text-border">/</span>
        {row.packer || EMPTY_VALUE}
      </div>
    </div>
  );
}

export function ChickenSlicingProfitReportPageClient() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary>(emptySummary);
  const [filters, setFilters] = useState<ReportFilters>({
    mainProducts: [],
    slicedProducts: [],
  });

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mainProductId, setMainProductId] = useState("ALL");
  const [slicedProductId, setSlicedProductId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState("5000");
  const [isLoading, setIsLoading] = useState(true);

  async function loadReport(overrides: LoadParams = {}) {
    setIsLoading(true);

    const nextDateFrom = overrides.dateFrom ?? dateFrom;
    const nextDateTo = overrides.dateTo ?? dateTo;
    const nextMainProductId = overrides.mainProductId ?? mainProductId;
    const nextSlicedProductId = overrides.slicedProductId ?? slicedProductId;
    const nextSearch = overrides.search ?? search;
    const nextLimit = overrides.limit ?? limit;

    const params = new URLSearchParams({
      limit: nextLimit,
    });

    if (nextDateFrom) params.set("dateFrom", nextDateFrom);
    if (nextDateTo) params.set("dateTo", nextDateTo);
    if (nextMainProductId !== "ALL") params.set("mainProductId", nextMainProductId);
    if (nextSlicedProductId !== "ALL") params.set("slicedProductId", nextSlicedProductId);
    if (nextSearch.trim()) params.set("search", nextSearch.trim());

    try {
      const res = await fetch(`/api/reports/chicken-slicing?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load chicken slicing report.");
      }

      setRows(json.data || []);
      setSummary(json.summary || emptySummary);
      setFilters(
        json.filters || {
          mainProducts: [],
          slicedProducts: [],
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load chicken slicing report."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadReport();
    });

    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    void loadReport();
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setMainProductId("ALL");
    setSlicedProductId("ALL");
    setSearch("");
    setLimit("5000");

    void loadReport({
      dateFrom: "",
      dateTo: "",
      mainProductId: "ALL",
      slicedProductId: "ALL",
      search: "",
      limit: "5000",
    });
  }

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Chicken Slicing Profit Report"
        description="Search slicing profit by date, chicken size, and sliced product."
        actions={
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        }
      />

      <Card className="rounded-2xl border-border shadow-sm print:hidden">
        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
            <div className="space-y-2 xl:col-span-2">
              <Label className={filterLabelClass}>Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div className="space-y-2 xl:col-span-2">
              <Label className={filterLabelClass}>Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2 xl:col-span-3">
              <Label className={filterLabelClass}>Size / Whole Chicken</Label>
              <Select value={mainProductId} onValueChange={setMainProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {filters.mainProducts.map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2 xl:col-span-3">
              <Label className={filterLabelClass}>Sliced Product</Label>
              <Select value={slicedProductId} onValueChange={setSlicedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {filters.slicedProducts.map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 xl:col-span-2">
              <Label className={filterLabelClass}>Show</Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger>
                  <SelectValue placeholder="Show" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1,000</SelectItem>
                  <SelectItem value="5000">5,000</SelectItem>
                  <SelectItem value="10000">10,000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2 xl:col-span-10">
              <Label className={filterLabelClass}>Search Product</Label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyFilters();
                }}
                placeholder="OS1, C10, C59..."
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-2">
              <Button type="button" onClick={applyFilters} className="flex-1">
                <Search className="mr-2 h-4 w-4" />
                Filter
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={resetFilters}
                className="shrink-0"
                aria-label="Reset filters"
              >
                <RefreshCcw className="h-4 w-4" />
                <span className="sr-only">Reset</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Capital" value={formatMoney(summary.totalCapital)} />
        <SummaryCard label="Total Amount" value={formatMoney(summary.totalGross)} />
        <SummaryCard
          label="Net Profit"
          value={formatMoney(summary.totalProfit)}
          className={profitTone(summary.totalProfit)}
        />
        <SummaryCard label="Total Kilos" value={formatNumber(summary.totalKilos, 2)} />
        <SummaryCard label="Total Packs" value={formatNumber(summary.totalPacks)} />
      </div>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="border-b print:border-b-0">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <CardTitle>Results</CardTitle>
            <div className="text-sm text-muted-foreground">
              Total Rows:{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(summary.totalRows)}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-muted/20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
              No chicken slicing records found.
            </div>
          ) : (
            <>
              <div className="space-y-3 print:hidden xl:hidden">
                {rows.map((row) => (
                  <ReportMobileRow key={row._id} row={row} />
                ))}

                <div className="rounded-xl border border-border bg-muted/40 p-4 font-bold">
                  <div className="flex items-center justify-between gap-4">
                    <span>Total Profit</span>
                    <span className={cn("tabular-value", profitTone(summary.totalProfit))}>
                      {formatMoney(summary.totalProfit)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden overflow-hidden rounded-xl border border-border print:block xl:block">
                <Table className="min-w-[1240px]">
                  <TableHeader className="bg-muted/70">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-3 py-3">Date</TableHead>
                      <TableHead className="min-w-44 px-3 py-3">Products</TableHead>
                      <TableHead className="min-w-44 px-3 py-3">Input</TableHead>
                      <TableHead className="min-w-36 px-3 py-3">Standard</TableHead>
                      <TableHead className="min-w-44 px-3 py-3">Output</TableHead>
                      <TableHead className="min-w-40 px-3 py-3">Pricing</TableHead>
                      <TableHead className="px-3 py-3 text-right">Capital</TableHead>
                      <TableHead className="px-3 py-3 text-right">Total</TableHead>
                      <TableHead className="px-3 py-3 text-right">Profit</TableHead>
                      <TableHead className="min-w-36 px-3 py-3">Crew</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row._id} className="align-top">
                        <TableCell className="px-3 py-3 font-medium">
                          {formatDate(row.date)}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="font-bold text-foreground">
                            {row.mainProductName || EMPTY_VALUE}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Sliced: {row.slicedProductName || EMPTY_VALUE}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="space-y-1">
                            <DetailLine label="Heads" value={formatNumber(row.heads)} />
                            <DetailLine label="Kilos" value={formatNumber(row.kilos, 2)} />
                            <DetailLine label="Delivery" value={formatMoney(row.deliveryPrice)} />
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="space-y-1">
                            <DetailLine label="Slice" value={formatNumber(row.standardSlice)} />
                            <DetailLine label="Pack" value={formatNumber(row.standardPacking)} />
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="space-y-1">
                            <DetailLine label="Actual PCS" value={formatNumber(row.actualPcs)} />
                            <DetailLine label="Packs" value={formatNumber(row.actualPacks)} />
                            <DetailLine label="Loose" value={formatNumber(row.loosePcs)} />
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="space-y-1">
                            <DetailLine label="PCS" value={formatMoney(row.pricePerPcs)} />
                            <DetailLine label="Pack" value={formatMoney(row.pricePerPack)} />
                          </div>
                        </TableCell>
                        <TableCell className="tabular-value px-3 py-3 text-right font-semibold">
                          {formatMoney(row.capital)}
                        </TableCell>
                        <TableCell className="tabular-value px-3 py-3 text-right font-semibold">
                          {formatMoney(row.gross)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "tabular-value px-3 py-3 text-right font-black",
                            profitTone(row.profit)
                          )}
                        >
                          {formatMoney(row.profit)}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="font-medium text-foreground">
                            {row.slicer || EMPTY_VALUE}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.packer || EMPTY_VALUE}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>

                  <TableFooter>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableCell className="px-3 py-3 font-black">TOTAL</TableCell>
                      <TableCell />
                      <TableCell className="px-3 py-3">
                        <div className="space-y-1">
                          <DetailLine label="Heads" value={formatNumber(summary.totalHeads)} />
                          <DetailLine label="Kilos" value={formatNumber(summary.totalKilos, 2)} />
                        </div>
                      </TableCell>
                      <TableCell />
                      <TableCell className="px-3 py-3">
                        <div className="space-y-1">
                          <DetailLine
                            label="Actual PCS"
                            value={formatNumber(summary.totalActualPcs)}
                          />
                          <DetailLine label="Packs" value={formatNumber(summary.totalPacks)} />
                          <DetailLine
                            label="Loose"
                            value={formatNumber(summary.totalLoosePcs)}
                          />
                        </div>
                      </TableCell>
                      <TableCell />
                      <TableCell className="tabular-value px-3 py-3 text-right font-black">
                        {formatMoney(summary.totalCapital)}
                      </TableCell>
                      <TableCell className="tabular-value px-3 py-3 text-right font-black">
                        {formatMoney(summary.totalGross)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tabular-value px-3 py-3 text-right font-black",
                          profitTone(summary.totalProfit)
                        )}
                      >
                        {formatMoney(summary.totalProfit)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

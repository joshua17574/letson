"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type SlicingHistoryItem = {
  _id: string;
  batchId?: string;
  mainProductName: string;
  slicedProductName: string;
  qtyToSlice: number;
  heads?: number;
  actualSlicedPcs: number;
  standardSlice?: number;
  standardPacking: number;
  totalStdPcs?: number;
  actualPacks: number;
  butal?: number;
  variance: number;
  kilos: number;
  bags: number;
  slicingDate?: string;
  slicer?: string;
  packer?: string;
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function numberValue(value: string | number | undefined | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toISOString().slice(0, 10);
}

function formatPercent(value: number) {
  return `${numberValue(value).toFixed(2)}%`;
}

function getStdPcs(record: SlicingHistoryItem) {
  const existing = numberValue(record.totalStdPcs);
  if (existing > 0) return existing;

  const heads = numberValue(record.heads ?? record.qtyToSlice);
  const standardSlice = numberValue(record.standardSlice);
  return heads * standardSlice;
}

function getLoosePcs(record: SlicingHistoryItem) {
  const existing = numberValue(record.butal);
  if (existing >= 0 && typeof record.butal !== "undefined") return existing;

  const actualPcs = numberValue(record.actualSlicedPcs);
  const packSize = numberValue(record.standardPacking);
  if (packSize <= 0) return actualPcs;

  return actualPcs % packSize;
}

function getYieldRate(record: SlicingHistoryItem) {
  const stdPcs = getStdPcs(record);
  if (stdPcs <= 0) return 0;
  return (numberValue(record.actualSlicedPcs) / stdPcs) * 100;
}

export function SliceHistoryPageClient() {
  const [records, setRecords] = useState<SlicingHistoryItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
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
  const [isLoading, setIsLoading] = useState(true);

  const totals = useMemo(() => {
    const computed = records.reduce(
      (sum, record) => {
        const stdPcs = getStdPcs(record);
        return {
          heads: sum.heads + numberValue(record.heads ?? record.qtyToSlice),
          kilos: sum.kilos + numberValue(record.kilos),
          stdPcs: sum.stdPcs + stdPcs,
          actualPcs: sum.actualPcs + numberValue(record.actualSlicedPcs),
          packs: sum.packs + numberValue(record.actualPacks),
          loosePcs: sum.loosePcs + getLoosePcs(record),
          variance: sum.variance + numberValue(record.variance),
        };
      },
      {
        heads: 0,
        kilos: 0,
        stdPcs: 0,
        actualPcs: 0,
        packs: 0,
        loosePcs: 0,
        variance: 0,
      }
    );

    return {
      ...computed,
      yieldRate: computed.stdPcs > 0 ? (computed.actualPcs / computed.stdPcs) * 100 : 0,
    };
  }, [records]);

  async function loadProducts() {
    try {
      const res = await fetch("/api/bodega-products?limit=1000", {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setProducts(json.data || []);
      }
    } catch {
      toast.error("Failed to load bodega products.");
    }
  }

  async function handleDelete(record: SlicingHistoryItem) {
    const batchId = record.batchId || record._id;
    const confirmed = window.confirm(
      "Are you sure you want to void this slicing batch?"
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/slicing/${batchId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to void slicing batch.");
      }

      toast.success(json.message || "Slicing batch voided successfully.");
      await loadRecords();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to void slicing batch."
      );
    }
  }

  async function loadRecords() {
    setIsLoading(true);

    const params = new URLSearchParams({
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
        throw new Error(json.message || "Failed to load slicing records.");
      }

      setRecords(json.data || []);
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
        error instanceof Error ? error.message : "Failed to load slicing records."
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
    setPage(1);
  }

  function printPage() {
    window.print();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Slice History</h1>
        <p className="text-sm text-muted-foreground">
          Production history only. Profit and price information is hidden from this page.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total Heads</p>
            <p className="text-2xl font-bold">{totals.heads.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Std PCS</p>
            <p className="text-2xl font-bold">{totals.stdPcs.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Actual PCS</p>
            <p className="text-2xl font-bold">{totals.actualPcs.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Full Packs</p>
            <p className="text-2xl font-bold">{totals.packs.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Loose PCS</p>
            <p className="text-2xl font-bold">{totals.loosePcs.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Variance</p>
            <p className="text-2xl font-bold">{totals.variance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Yield</p>
            <p className="text-2xl font-bold">{formatPercent(totals.yieldRate)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-5">
          <div>
            <Label>Show</Label>
            <Select
              value={limit}
              onValueChange={(value) => {
                setLimit(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
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

          <div>
            <Label>Sliced Product</Label>
            <Select value={slicedProductId} onValueChange={setSlicedProductId}>
              <SelectTrigger>
                <SelectValue />
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

          <div>
            <Label>From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>

          <div>
            <Label>To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>

          <div className="flex items-end gap-2">
            <Button onClick={applyFilters}>
              <Search className="mr-2 h-4 w-4" />
              Apply
            </Button>
            <Button variant="secondary" onClick={resetFilters}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Slicing Records</CardTitle>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/slicing/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Slicing
              </Link>
            </Button>
            <Button variant="secondary" onClick={printPage}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader className="bg-slate-950">
                <TableRow>
                  <TableHead className="text-white">Date</TableHead>
                  <TableHead className="text-white">Main Product</TableHead>
                  <TableHead className="text-white">Sliced Product</TableHead>
                  <TableHead className="text-right text-white">Heads</TableHead>
                  <TableHead className="text-right text-white">Kilos</TableHead>
                  <TableHead className="text-right text-white">Std PCS</TableHead>
                  <TableHead className="text-right text-white">Actual PCS</TableHead>
                  <TableHead className="text-right text-white">Pack Size</TableHead>
                  <TableHead className="text-right text-white">Full Packs / Loose PCS</TableHead>
                  <TableHead className="text-right text-white">Yield</TableHead>
                  <TableHead className="text-right text-white">Variance</TableHead>
                  <TableHead className="text-right text-white">Bags</TableHead>
                  <TableHead className="text-white">Slicer / Packer</TableHead>
                  <TableHead className="text-center text-white">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={14} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="h-32 text-center text-muted-foreground">
                      No slicing records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => {
                    const stdPcs = getStdPcs(record);
                    const loosePcs = getLoosePcs(record);
                    const yieldRate = getYieldRate(record);
                    const variance = numberValue(record.variance);

                    return (
                      <TableRow key={record._id}>
                        <TableCell>{formatDate(record.slicingDate)}</TableCell>
                        <TableCell className="font-medium">{record.mainProductName}</TableCell>
                        <TableCell>{record.slicedProductName}</TableCell>
                        <TableCell className="text-right">
                          {numberValue(record.heads ?? record.qtyToSlice).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {numberValue(record.kilos).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right">{stdPcs.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {numberValue(record.actualSlicedPcs).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {numberValue(record.standardPacking).toLocaleString()} pcs
                        </TableCell>
                        <TableCell className="text-right">
                          {numberValue(record.actualPacks).toLocaleString()} packs / {loosePcs.toLocaleString()} pcs
                        </TableCell>
                        <TableCell className="text-right">{formatPercent(yieldRate)}</TableCell>
                        <TableCell
                          className={
                            variance < 0
                              ? "text-right font-semibold text-red-600"
                              : variance > 0
                                ? "text-right font-semibold text-emerald-700"
                                : "text-right"
                          }
                        >
                          {variance.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {numberValue(record.bags).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{record.slicer || "—"}</div>
                            <div className="text-muted-foreground">{record.packer || "—"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(record)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <div>
              Showing {records.length} of {meta.total} records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Previous
              </Button>
              <span>
                Page {meta.page} of {meta.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= meta.totalPages || isLoading}
                onClick={() => setPage((current) => Math.min(current + 1, meta.totalPages))}
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

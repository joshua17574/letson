"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Loader2,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
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
  mainProductName: string;
  slicedProductName: string;
  qtyToSlice: number;
  actualSlicedPcs: number;
  standardPacking: number;
  actualPacks: number;
  variance: number;
  kilos: number;
  bags: number;
  slicingDate?: string;
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

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

  async function loadProducts() {
    try {
      const res = await fetch("/api/products?limit=100", {
        cache: "no-store",
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setProducts(json.data || []);
      }
    } catch {
      toast.error("Failed to load products.");
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
        error instanceof Error
          ? error.message
          : "Failed to load slicing records."
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

  function formatDate(value?: string) {
    if (!value) return "—";
    return new Date(value).toISOString().slice(0, 10);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Slice History
      </h1>

      <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm lg:flex-row lg:items-end">
        <div className="w-full lg:w-32">
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

        <div className="w-full lg:w-80">
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

        <div className="w-full lg:w-48">
          <Label>From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>

        <div className="w-full lg:w-48">
          <Label>To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>

        <Button onClick={applyFilters}>
          <Search className="mr-2 h-4 w-4" />
          Apply
        </Button>

        <Button variant="outline" onClick={resetFilters}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b">
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

        <CardContent className="p-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-slate-900">
                <TableRow>
                  <TableHead className="text-center text-white">Main Product</TableHead>
                  <TableHead className="text-center text-white">
                    Sliced Product
                  </TableHead>
                  <TableHead className="text-center text-white">
                    Qty to Slice
                  </TableHead>
                  <TableHead className="text-center text-white">
                    Actual Sliced PCS
                  </TableHead>
                  <TableHead className="text-center text-white">
                    Standard Packing
                  </TableHead>
                  <TableHead className="text-center text-white">
                    Actual Packs
                  </TableHead>
                  <TableHead className="text-center text-white">Variance</TableHead>
                  <TableHead className="text-center text-white">Kilos</TableHead>
                  <TableHead className="text-center text-white">Bags</TableHead>
                  <TableHead className="text-center text-white">
                    Slicing Date
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No slicing records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record._id}>
                      <TableCell className="text-center">
                        {record.mainProductName}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.slicedProductName}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.qtyToSlice}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.actualSlicedPcs}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.standardPacking}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.actualPacks}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.variance}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.kilos.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.bags}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatDate(record.slicingDate)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {records.length} of {meta.total} records
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Previous
              </Button>

              <span className="rounded-md border px-3 py-2">
                Page {meta.page} of {meta.totalPages}
              </span>

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
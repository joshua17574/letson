"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, Search } from "lucide-react";
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
import { formatPeso } from "@/lib/utils";

type ProductSummary = {
  _id: string;
  name: string;
  currentStock: number;
  price: number;
  lastUpdated?: string;
};

type BodegaDetail = {
  _id: string;
  date?: string;
  type: "IN" | "OUT";
  reference: string;
  qtyIn: number;
  qtyOut: number;
  previousStock: number;
  newStock: number;
  remarks: string;
};

type Props = {
  productId: string;
};

export function BodegaStockMovementDetailsPageClient({ productId }: Props) {
  const [product, setProduct] = useState<ProductSummary | null>(null);
  const [rows, setRows] = useState<BodegaDetail[]>([]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: "",
    dateTo: "",
  });

  const [isLoading, setIsLoading] = useState(true);

  async function loadDetails() {
    setIsLoading(true);

    const params = new URLSearchParams();

    if (appliedFilters.dateFrom) {
      params.set("dateFrom", appliedFilters.dateFrom);
    }

    if (appliedFilters.dateTo) {
      params.set("dateTo", appliedFilters.dateTo);
    }

    try {
      const res = await fetch(
        `/api/inventory/bodega/${productId}?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Failed to load bodega movement details."
        );
      }

      setProduct(json.product || null);
      setRows(json.data || []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load bodega movement details."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, appliedFilters]);

  function applyFilters() {
    setAppliedFilters({
      dateFrom,
      dateTo,
    });
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setAppliedFilters({
      dateFrom: "",
      dateTo: "",
    });
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

  function typeBadge(type: "IN" | "OUT") {
    const className =
      type === "IN"
        ? "rounded bg-emerald-600 px-2 py-1 text-xs font-bold text-white"
        : "rounded bg-rose-600 px-2 py-1 text-xs font-bold text-white";

    return <span className={className}>{type}</span>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Bodega Stock Movement Details
        </h1>

        <Button variant="secondary" asChild>
          <Link href="/inventory/bodega">Back</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-sm font-semibold">Product</p>
            <p>{product?.name || "—"}</p>
          </div>

          <div>
            <p className="text-sm font-semibold">Current Stock</p>
            <p>{formatNumber(product?.currentStock || 0)}</p>
          </div>

          <div>
            <p className="text-sm font-semibold">Price</p>
            <p>{formatPeso(product?.price || 0)}</p>
          </div>

          <div>
            <p className="text-sm font-semibold">Last Updated</p>
            <p>{formatDate(product?.lastUpdated)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[2fr_1.5fr_1.5fr_auto_auto]">
        <div className="space-y-2">
          <Label>Product</Label>
          <Input value={product?.name || ""} disabled />
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
            <RefreshCcw className="mr-2 h-4 w-4" />
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
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Qty In</TableHead>
                  <TableHead className="text-right">Qty Out</TableHead>
                  <TableHead className="text-right">Previous Stock</TableHead>
                  <TableHead className="text-right">New Stock</TableHead>
                  <TableHead>Remarks</TableHead>
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
                      No bodega movement details found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => (
                    <TableRow key={row._id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell>{typeBadge(row.type)}</TableCell>
                      <TableCell>{row.reference}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.qtyIn)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.qtyOut)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.previousStock)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.newStock)}
                      </TableCell>
                      <TableCell>{row.remarks || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
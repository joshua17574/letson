"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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

type ProductSummary = {
  _id: string;
  name: string;
  currentStock: number;
  price: number;
  lastUpdated?: string;
  isPackProduct?: boolean;
  packSize?: number;
  currentStockPcs?: number;
  currentStockPacks?: number;
  currentStockLoosePcs?: number;
  pricePerPack?: number;
  pricePerPcs?: number;
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
  quantityPacks?: number;
  quantityLoosePcs?: number;
  previousStockPacks?: number;
  previousStockLoosePcs?: number;
  newStockPacks?: number;
  newStockLoosePcs?: number;
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
    if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
    if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);

    try {
      const res = await fetch(`/api/inventory/bodega/${productId}?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load bodega movement details.");
      }

      setProduct(json.product || null);
      setRows(json.data || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load bodega movement details."
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
    setAppliedFilters({ dateFrom: "", dateTo: "" });
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

  function typeBadge(type: "IN" | "OUT") {
    const className =
      type === "IN"
        ? "rounded bg-emerald-600 px-2 py-1 text-xs font-bold text-white"
        : "rounded bg-rose-600 px-2 py-1 text-xs font-bold text-white";

    return <span className={className}>{type}</span>;
  }

  function renderStockQuantity(
    totalQty: number,
    packs?: number,
    loosePcs?: number
  ) {
    if (!product?.isPackProduct || !product.packSize) {
      return formatNumber(totalQty);
    }

    return (
      <div className="text-right leading-tight">
        <div className="font-semibold">
          {formatWholeNumber(packs)} pack{Number(packs || 0) === 1 ? "" : "s"}
          {Number(loosePcs || 0) > 0 ? ` / ${formatWholeNumber(loosePcs)} pcs` : ""}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatWholeNumber(totalQty)} pcs total
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bodega Stock Movement Details</h1>
          <p className="text-sm text-muted-foreground">
            Transaction history for one bodega product.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/inventory/bodega">Back</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Product</p>
            <p className="mt-1 text-lg font-bold">{product?.name || "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Current Stock</p>
            <div className="mt-1 text-lg font-bold">
              {product?.isPackProduct
                ? renderStockQuantity(
                    product.currentStock,
                    product.currentStockPacks,
                    product.currentStockLoosePcs
                  )
                : formatNumber(product?.currentStock || 0)}
            </div>
            {product?.isPackProduct ? (
              <p className="text-xs text-muted-foreground">
                {formatWholeNumber(product.packSize)} pcs / pack
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {product?.isPackProduct ? "Price / Pack" : "Price"}
            </p>
            <p className="mt-1 text-lg font-bold">
              {product?.isPackProduct
                ? formatPeso(product.pricePerPack || 0)
                : formatPeso(product?.price || 0)}
            </p>
            {product?.isPackProduct ? (
              <p className="text-xs text-muted-foreground">
                Price / PCS: {formatPeso(product.pricePerPcs || 0)}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Last updated: {formatDate(product?.lastUpdated)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
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
            <Button onClick={applyFilters}>Filter</Button>
            <Button variant="secondary" onClick={resetFilters}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
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
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
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
                        {row.qtyIn > 0
                          ? renderStockQuantity(row.qtyIn, row.quantityPacks, row.quantityLoosePcs)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.qtyOut > 0
                          ? renderStockQuantity(row.qtyOut, row.quantityPacks, row.quantityLoosePcs)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderStockQuantity(
                          row.previousStock,
                          row.previousStockPacks,
                          row.previousStockLoosePcs
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderStockQuantity(row.newStock, row.newStockPacks, row.newStockLoosePcs)}
                      </TableCell>
                      <TableCell>{row.remarks || "-"}</TableCell>
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

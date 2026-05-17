"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleHeader } from "@/components/app-shell/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPeso } from "@/lib/utils";

type BodegaProductOption = {
  _id: string;
  name: string;
  buyingPrice: number;
  stockQty?: number;
};

type PurchaseBatch = {
  _id: string;
  datePurchased: string;
  totalItems: number;
  totalAmount: number;
};

type PurchaseItemForm = {
  bodegaProductId: string;
  buyingPrice: string;
  quantity: string;
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Summary = {
  filteredBatches: number;
  totalItems: number;
  grandTotalAmount: number;
};

const emptyItem: PurchaseItemForm = {
  bodegaProductId: "",
  buyingPrice: "0",
  quantity: "0",
};

export function PurchaseBatchesPageClient() {
  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [products, setProducts] = useState<BodegaProductOption[]>([]);

  const [summary, setSummary] = useState<Summary>({
    filteredBatches: 0,
    totalItems: 0,
    grandTotalAmount: 0,
  });

  const [meta, setMeta] = useState<ApiMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState("10");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minTotal, setMinTotal] = useState("");
  const [maxTotal, setMaxTotal] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: "",
    dateTo: "",
    minTotal: "",
    maxTotal: "",
  });

  const [datePurchased, setDatePurchased] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [items, setItems] = useState<PurchaseItemForm[]>([
    { ...emptyItem },
    { ...emptyItem },
    { ...emptyItem },
  ]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const price = Number(item.buyingPrice) || 0;
      const qty = Number(item.quantity) || 0;

      return sum + price * qty;
    }, 0);
  }, [items]);

  async function loadProducts() {
    try {
      const res = await fetch("/api/bodega-products?limit=1000", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load products.");
      }

      setProducts(json.data || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load products."
      );
    }
  }

  async function loadBatches() {
    setIsLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      limit,
    });

    if (appliedFilters.dateFrom) {
      params.set("dateFrom", appliedFilters.dateFrom);
    }

    if (appliedFilters.dateTo) {
      params.set("dateTo", appliedFilters.dateTo);
    }

    if (appliedFilters.minTotal) {
      params.set("minTotal", appliedFilters.minTotal);
    }

    if (appliedFilters.maxTotal) {
      params.set("maxTotal", appliedFilters.maxTotal);
    }

    try {
      const res = await fetch(`/api/purchase-batches?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load purchase batches.");
      }

      setBatches(json.data || []);
      setSummary(
        json.summary || {
          filteredBatches: 0,
          totalItems: 0,
          grandTotalAmount: 0,
        }
      );
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
          : "Failed to load purchase batches."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    void loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, appliedFilters]);

  function openCreateDrawer() {
    setDatePurchased(new Date().toISOString().slice(0, 10));
    setItems([{ ...emptyItem }, { ...emptyItem }, { ...emptyItem }]);
    setDrawerOpen(true);
  }

  function updateItem(
    index: number,
    field: keyof PurchaseItemForm,
    value: string
  ) {
    setItems((current) => {
      const next = [...current];

      next[index] = {
        ...next[index],
        [field]: value,
      };

      if (field === "bodegaProductId") {
        const product = products.find((item) => item._id === value);

        if (product) {
          next[index].buyingPrice = String(product.buyingPrice || 0);
        }
      }

      return next;
    });
  }

  function addItemRow() {
    setItems((current) => [...current, { ...emptyItem }]);
  }

  function removeItemRow(index: number) {
    setItems((current) => {
      if (current.length === 1) return current;
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function applyFilters() {
    setAppliedFilters({
      dateFrom,
      dateTo,
      minTotal,
      maxTotal,
    });
    setPage(1);
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setMinTotal("");
    setMaxTotal("");

    setAppliedFilters({
      dateFrom: "",
      dateTo: "",
      minTotal: "",
      maxTotal: "",
    });

    setPage(1);
  }

  async function saveBatch() {
    if (!datePurchased) {
      toast.error("Date purchased is required.");
      return;
    }

    const validItems = items
      .filter((item) => item.bodegaProductId && Number(item.quantity) > 0)
      .map((item) => ({
        bodegaProductId: item.bodegaProductId,
        buyingPrice: Number(item.buyingPrice) || 0,
        quantity: Number(item.quantity) || 0,
      }));

    if (validItems.length === 0) {
      toast.error("Add at least one product with quantity.");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/purchase-batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          datePurchased,
          items: validItems,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save purchase batch.");
      }

      toast.success(json.message || "Purchase batch saved successfully.");

      setDrawerOpen(false);
      await loadBatches();
      await loadProducts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save purchase batch."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteBatch(batch: PurchaseBatch) {
    const confirmed = window.confirm(
      `Delete purchase batch dated ${formatDate(
        batch.datePurchased
      )}? This will reverse the added bodega stock.`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/purchase-batches/${batch._id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete purchase batch.");
      }

      toast.success(json.message || "Purchase batch deleted successfully.");

      await loadBatches();
      await loadProducts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete purchase batch."
      );
    }
  }

  function formatDate(value?: string) {
    if (!value) return "—";
    return new Date(value).toISOString().slice(0, 10);
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Purchase Batches"
        description="Record purchased bodega items and automatically add them to stock."
        actions={
          <Button onClick={openCreateDrawer} className="rounded-xl">
            <PackagePlus className="mr-2 h-4 w-4" />
            Add Purchase Batch
          </Button>
        }
      />

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Search className="h-4 w-4 text-red-500" />
            Filter Purchases
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum Total</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={minTotal}
                onChange={(event) => setMinTotal(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Maximum Total</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={maxTotal}
                onChange={(event) => setMaxTotal(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="flex items-end">
              <Button onClick={applyFilters} className="w-full rounded-xl">
                Apply
              </Button>
            </div>

            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={resetFilters}
                className="w-full rounded-xl"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Filtered Batches</p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {summary.filteredBatches.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Total Items</p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {summary.totalItems.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Grand Total Amount</p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {formatPeso(summary.grandTotalAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-950">
                Purchase Batch Records
              </p>
              <p className="text-sm text-slate-500">
                Showing {batches.length} of {meta.total} records
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm">Show</Label>
              <Select
                value={limit}
                onValueChange={(value) => {
                  setLimit(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-24">
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
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-950">
                <TableRow>
                  <TableHead className="text-white">Date</TableHead>
                  <TableHead className="text-right text-white">
                    Total Items
                  </TableHead>
                  <TableHead className="text-right text-white">
                    Total Amount
                  </TableHead>
                  <TableHead className="text-center text-white">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-36 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                    </TableCell>
                  </TableRow>
                ) : batches.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-36 text-center text-slate-500"
                    >
                      No purchase batches found.
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow key={batch._id}>
                      <TableCell className="font-medium">
                        {formatDate(batch.datePurchased)}
                      </TableCell>

                      <TableCell className="text-right">
                        {batch.totalItems.toLocaleString()}
                      </TableCell>

                      <TableCell className="text-right font-semibold">
                        {formatPeso(batch.totalAmount)}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="rounded-xl"
                          onClick={() => deleteBatch(batch)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              Previous
            </Button>

            <span className="rounded-xl border px-3 py-2 text-sm text-slate-600">
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
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-3xl"
        >
          <SheetHeader>
            <SheetTitle className="text-2xl font-black">
              Add Purchase Batch
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label>Date Purchased</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  type="date"
                  value={datePurchased}
                  onChange={(event) => setDatePurchased(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const subtotal =
                  (Number(item.buyingPrice) || 0) *
                  (Number(item.quantity) || 0);

                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                      <Select
                        value={item.bodegaProductId}
                        onValueChange={(value) =>
                          updateItem(index, "bodegaProductId", value)
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Search product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product._id} value={product._id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.buyingPrice}
                        onChange={(event) =>
                          updateItem(index, "buyingPrice", event.target.value)
                        }
                        placeholder="Buying Price"
                        className="bg-white"
                      />

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        placeholder="Qty"
                        className="bg-white"
                      />

                      <Input
                        value={subtotal.toFixed(2)}
                        disabled
                        className="bg-white"
                      />

                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => removeItemRow(index)}
                        className="rounded-xl"
                      >
                        X
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-sm text-white/70">Total</p>
              <p className="text-3xl font-black">{formatPeso(totalAmount)}</p>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-xl"
              onClick={addItemRow}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add More
            </Button>
          </div>

          <SheetFooter className="mt-8 flex-col gap-2 sm:flex-col">
            <Button
              onClick={saveBatch}
              disabled={isSaving}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Batch
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              className="w-full rounded-xl"
              onClick={() => setDrawerOpen(false)}
            >
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
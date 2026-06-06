"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  Boxes,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleHeader } from "@/components/app-shell/ModuleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { cn, formatPeso } from "@/lib/utils";

type CategoryOption = {
  _id: string;
  name: string;
};

type ProductInventoryItem = {
  _id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  buyingPrice: number;
  unitPrice: number;
  stockPcs: number;
  stockBags: number;
  stockKilos: number;
  lowStockAlert: number;
  isLowStock: boolean;
  estimatedCostValue: number;
  estimatedSellingValue: number;
};

type ProductInventorySummary = {
  totalProducts: number;
  totalPcs: number;
  totalBags: number;
  totalKilos: number;
  totalCostValue: number;
  totalSellingValue: number;
  lowStockCount: number;
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type StockAction = "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";
type StockUnit = "PCS" | "BAGS" | "KILOS";

const emptyForm = {
  name: "",
  categoryId: "",
  buyingPrice: "0",
  unitPrice: "0",
  stockPcs: "0",
  stockBags: "0",
  stockKilos: "0",
  lowStockAlert: "0",
};

const emptyStockForm = {
  action: "STOCK_IN" as StockAction,
  unit: "PCS" as StockUnit,
  quantity: "0",
  newStock: "0",
  remarks: "",
};

const emptySummary: ProductInventorySummary = {
  totalProducts: 0,
  totalPcs: 0,
  totalBags: 0,
  totalKilos: 0,
  totalCostValue: 0,
  totalSellingValue: 0,
  lowStockCount: 0,
};

function formatNumber(value: number, digits = 0) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function getStockByUnit(product: ProductInventoryItem, unit: StockUnit) {
  if (unit === "BAGS") return product.stockBags;
  if (unit === "KILOS") return product.stockKilos;
  return product.stockPcs;
}

export function ProductInventoryPageClient() {
  const [items, setItems] = useState<ProductInventoryItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [summary, setSummary] = useState<ProductInventorySummary>(emptySummary);
  const [meta, setMeta] = useState<ApiMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState("10");
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [stockStatus, setStockStatus] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductInventoryItem | null>(null);
  const [stockItem, setStockItem] = useState<ProductInventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [stockForm, setStockForm] = useState(emptyStockForm);

  const stockCurrentValue = useMemo(() => {
    if (!stockItem) return 0;
    return getStockByUnit(stockItem, stockForm.unit);
  }, [stockItem, stockForm.unit]);

  async function loadCategories() {
    try {
      const res = await fetch("/api/categories?limit=100", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load categories.");
      }

      setCategories(json.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load categories.");
    }
  }

  async function loadItems() {
    setIsLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      limit,
    });

    if (search) params.set("search", search);
    if (categoryId !== "ALL") params.set("categoryId", categoryId);
    if (stockStatus !== "ALL") params.set("stockStatus", stockStatus);

    try {
      const res = await fetch(`/api/inventory/products?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load grocery/product inventory.");
      }

      setItems(json.data || []);
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
        error instanceof Error
          ? error.message
          : "Failed to load grocery/product inventory."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, categoryId, stockStatus]);

  function updateForm(name: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateStockForm(name: keyof typeof emptyStockForm, value: string) {
    setStockForm((current) => ({ ...current, [name]: value }));
  }

  function openCreateDialog() {
    setEditingItem(null);
    setForm(emptyForm);
    setFormDialogOpen(true);
  }

  function openEditDialog(product: ProductInventoryItem) {
    setEditingItem(product);
    setForm({
      name: product.name,
      categoryId: product.categoryId,
      buyingPrice: String(product.buyingPrice),
      unitPrice: String(product.unitPrice),
      stockPcs: String(product.stockPcs),
      stockBags: String(product.stockBags),
      stockKilos: String(product.stockKilos),
      lowStockAlert: String(product.lowStockAlert),
    });
    setFormDialogOpen(true);
  }

  function openStockDialog(product: ProductInventoryItem) {
    setStockItem(product);
    setStockForm({
      ...emptyStockForm,
      newStock: String(product.stockPcs),
    });
    setStockDialogOpen(true);
  }

  function applySearch() {
    setSearch(draftSearch.trim());
    setPage(1);
  }

  function resetFilters() {
    setDraftSearch("");
    setSearch("");
    setCategoryId("ALL");
    setStockStatus("ALL");
    setPage(1);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const url = editingItem
        ? `/api/inventory/products/${editingItem._id}`
        : "/api/inventory/products";

      const res = await fetch(url, {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save product inventory item.");
      }

      toast.success(json.message || "Product inventory item saved successfully.");
      setFormDialogOpen(false);
      await loadItems();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save product inventory item."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stockItem) return;

    setIsSaving(true);

    try {
      const res = await fetch(`/api/inventory/products/${stockItem._id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stockForm),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update product stock.");
      }

      toast.success(json.message || "Product stock updated successfully.");
      setStockDialogOpen(false);
      await loadItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update product stock.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteProduct(product: ProductInventoryItem) {
    const confirmed = window.confirm(`Delete ${product.name}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/inventory/products/${product._id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete product inventory item.");
      }

      toast.success(json.message || "Product inventory item deleted successfully.");
      await loadItems();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete product inventory item."
      );
    }
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="Inventory"
        title="Grocery/Product Inventory"
        description="Manage grocery products, prices, current stock, low stock alerts, and stock corrections."
        actions={
          <Button onClick={openCreateDialog} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Items</p>
            <p className="mt-2 text-2xl font-black">{formatNumber(summary.totalProducts)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current PCS</p>
            <p className="mt-2 text-2xl font-black">{formatNumber(summary.totalPcs)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bags / Kilos</p>
            <p className="mt-2 text-2xl font-black">
              {formatNumber(summary.totalBags)} / {formatNumber(summary.totalKilos, 2)}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost Value</p>
            <p className="mt-2 text-2xl font-black">{formatPeso(summary.totalCostValue)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Low Stock</p>
            <p className={cn("mt-2 text-2xl font-black", summary.lowStockCount > 0 && "text-amber-600")}>
              {formatNumber(summary.lowStockCount)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
          <Input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search grocery/product..."
            onKeyDown={(event) => {
              if (event.key === "Enter") applySearch();
            }}
          />

          <Select
            value={categoryId}
            onValueChange={(value) => {
              setCategoryId(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category._id} value={category._id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={stockStatus}
            onValueChange={(value) => {
              setStockStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Stock status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All stock</SelectItem>
              <SelectItem value="LOW">Low stock</SelectItem>
              <SelectItem value="OUT">Out of stock</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={applySearch}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
          <Button variant="secondary" onClick={resetFilters}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b bg-slate-50/70 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Boxes className="h-4 w-4" />
              Grocery/Product Stock List
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing {items.length} of {meta.total} records
            </p>
          </div>
          <Select
            value={limit}
            onValueChange={(value) => {
              setLimit(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 rows</SelectItem>
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader className="bg-slate-950">
                <TableRow>
                  <TableHead className="text-white">Product</TableHead>
                  <TableHead className="text-white">Category</TableHead>
                  <TableHead className="text-right text-white">Buying</TableHead>
                  <TableHead className="text-right text-white">Selling</TableHead>
                  <TableHead className="text-right text-white">PCS Now</TableHead>
                  <TableHead className="text-right text-white">Bags</TableHead>
                  <TableHead className="text-right text-white">Kilos</TableHead>
                  <TableHead className="text-right text-white">Low Alert</TableHead>
                  <TableHead className="text-center text-white">Status</TableHead>
                  <TableHead className="text-center text-white">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      No grocery/product inventory found.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((product) => (
                    <TableRow key={product._id}>
                      <TableCell className="font-bold">{product.name}</TableCell>
                      <TableCell>{product.categoryName || "-"}</TableCell>
                      <TableCell className="text-right">{formatPeso(product.buyingPrice)}</TableCell>
                      <TableCell className="text-right">{formatPeso(product.unitPrice)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatNumber(product.stockPcs)}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(product.stockBags)}</TableCell>
                      <TableCell className="text-right">{formatNumber(product.stockKilos, 2)}</TableCell>
                      <TableCell className="text-right">{formatNumber(product.lowStockAlert)}</TableCell>
                      <TableCell className="text-center">
                        {product.isLowStock ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Low
                          </Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openStockDialog(product)}>
                            <PackagePlus className="mr-1 h-4 w-4" />
                            Stock
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(product)}>
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteProduct(product)}>
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 p-4 lg:hidden">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
                No grocery/product inventory found.
              </div>
            ) : (
              items.map((product) => (
                <div key={product._id} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.categoryName || "No category"}</p>
                    </div>
                    {product.isLowStock ? (
                      <Badge variant="destructive">Low</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-muted-foreground">PCS Now</p>
                      <p className="font-bold">{formatNumber(product.stockPcs)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-muted-foreground">Bags / Kilos</p>
                      <p className="font-bold">
                        {formatNumber(product.stockBags)} / {formatNumber(product.stockKilos, 2)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-muted-foreground">Buying</p>
                      <p className="font-bold">{formatPeso(product.buyingPrice)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-muted-foreground">Selling</p>
                      <p className="font-bold">{formatPeso(product.unitPrice)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openStockDialog(product)}>
                      Stock
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(product)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteProduct(product)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-3 border-t p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {meta.page} of {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Previous
              </Button>
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

      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Grocery/Product" : "Add Grocery/Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveProduct} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="e.g. RICE, NOODLES, CANNED GOODS"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={(value) => updateForm("categoryId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category._id} value={category._id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Buying Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.buyingPrice}
                  onChange={(event) => updateForm("buyingPrice", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Selling Price / Unit</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(event) => updateForm("unitPrice", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock PCS</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stockPcs}
                  onChange={(event) => updateForm("stockPcs", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock Bags</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stockBags}
                  onChange={(event) => updateForm("stockBags", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock Kilos</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.stockKilos}
                  onChange={(event) => updateForm("stockKilos", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Low Stock Alert PCS</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.lowStockAlert}
                  onChange={(event) => updateForm("lowStockAlert", event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => setFormDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Stock: {stockItem?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveStock} className="space-y-4">
            <div className="rounded-xl border bg-slate-50 p-4 text-sm">
              Current selected stock: <span className="font-bold">{formatNumber(stockCurrentValue, stockForm.unit === "KILOS" ? 2 : 0)} {stockForm.unit}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Action</Label>
                <Select
                  value={stockForm.action}
                  onValueChange={(value) => updateStockForm("action", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STOCK_IN">Stock In</SelectItem>
                    <SelectItem value="STOCK_OUT">Stock Out</SelectItem>
                    <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={stockForm.unit}
                  onValueChange={(value) => {
                    const nextUnit = value as StockUnit;
                    updateStockForm("unit", nextUnit);
                    if (stockItem) {
                      updateStockForm("newStock", String(getStockByUnit(stockItem, nextUnit)));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PCS">PCS</SelectItem>
                    <SelectItem value="BAGS">BAGS</SelectItem>
                    <SelectItem value="KILOS">KILOS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {stockForm.action === "ADJUSTMENT" ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>New Stock</Label>
                  <Input
                    type="number"
                    min="0"
                    step={stockForm.unit === "KILOS" ? "0.01" : "1"}
                    value={stockForm.newStock}
                    onChange={(event) => updateStockForm("newStock", event.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2 md:col-span-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    step={stockForm.unit === "KILOS" ? "0.01" : "1"}
                    value={stockForm.quantity}
                    onChange={(event) => updateStockForm("quantity", event.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2 md:col-span-2">
                <Label>Remarks</Label>
                <Textarea
                  value={stockForm.remarks}
                  onChange={(event) => updateStockForm("remarks", event.target.value)}
                  placeholder="Optional reason or note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => setStockDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

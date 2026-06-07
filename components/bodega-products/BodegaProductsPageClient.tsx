// components/bodega-products/BodegaProductsPageClient.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
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
import { formatPeso } from "@/lib/utils";

type CategoryOption = {
  _id: string;
  name: string;
};

type BodegaProductItem = {
  _id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  stockQty: number;
  buyingPrice: number;
  sellingPrice: number;
  isPackProduct?: boolean;
  packSize?: number;
  stockPcs?: number;
  stockPacks?: number;
  stockLoosePcs?: number;
  stockDisplay?: string;
  pricePerPack?: number;
  pricePerPcs?: number;
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const emptyForm = {
  name: "",
  categoryId: "NONE",
  stockQty: "0",
  buyingPrice: "0",
  sellingPrice: "0",
};

const emptyStockForm = {
  quantity: "0",
  remarks: "",
};

function formatWholeNumber(value: number | undefined) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function renderStockSummary(product: BodegaProductItem) {
  if (!product.isPackProduct || !product.packSize) {
    return (
      <div className="text-right">
        <div className="font-semibold">{formatWholeNumber(product.stockQty)}</div>
        <div className="text-xs text-muted-foreground">base units</div>
      </div>
    );
  }

  return (
    <div className="text-right leading-tight">
      <div className="font-semibold text-slate-950">
        {formatWholeNumber(product.stockPacks)} packs
        {Number(product.stockLoosePcs || 0) > 0
          ? ` / ${formatWholeNumber(product.stockLoosePcs)} pcs loose`
          : ""}
      </div>
      <div className="text-xs text-muted-foreground">
        {formatWholeNumber(product.stockPcs)} pcs total
      </div>
      <div className="text-xs text-muted-foreground">
        {formatWholeNumber(product.packSize)} pcs / pack
      </div>
    </div>
  );
}

export function BodegaProductsPageClient() {
  const [products, setProducts] = useState<BodegaProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState("100");
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BodegaProductItem | null>(null);
  const [stockProduct, setStockProduct] = useState<BodegaProductItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [stockForm, setStockForm] = useState(emptyStockForm);

  async function loadCategories() {
    try {
      const res = await fetch("/api/categories?limit=100", {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load categories.");
      }

      setCategories(json.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load categories.");
    }
  }

  async function loadProducts() {
    setIsLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      limit,
    });

    if (search) params.set("search", search);
    if (categoryId !== "ALL") params.set("categoryId", categoryId);

    try {
      const res = await fetch(`/api/bodega-products?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load bodega products.");
      }

      setProducts(json.data || []);
      setMeta(
        json.meta || {
          page,
          limit: Number(limit),
          total: 0,
          totalPages: 1,
        }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load bodega products.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCategories();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, categoryId]);

  function updateForm(name: keyof typeof emptyForm, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateStockForm(name: keyof typeof emptyStockForm, value: string) {
    setStockForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openCreateDialog() {
    setEditingProduct(null);
    setForm(emptyForm);
    setFormDialogOpen(true);
  }

  function openEditDialog(product: BodegaProductItem) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      categoryId: product.categoryId || "NONE",
      stockQty: String(product.stockQty),
      buyingPrice: String(product.buyingPrice),
      sellingPrice: String(product.sellingPrice),
    });
    setFormDialogOpen(true);
  }

  function openStockDialog(product: BodegaProductItem) {
    setStockProduct(product);
    setStockForm(emptyStockForm);
    setStockDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    const payload = {
      ...form,
      categoryId: form.categoryId === "NONE" ? "" : form.categoryId,
    };

    try {
      const url = editingProduct
        ? `/api/bodega-products/${editingProduct._id}`
        : "/api/bodega-products";
      const res = await fetch(url, {
        method: editingProduct ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save bodega product.");
      }

      toast.success(json.message || "Bodega product saved successfully.");
      setFormDialogOpen(false);
      await loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save bodega product.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStockIn(event: React.FormEvent) {
    event.preventDefault();
    if (!stockProduct) return;

    setIsSaving(true);

    try {
      const res = await fetch(`/api/bodega-products/${stockProduct._id}/stock-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stockForm),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to add stock.");
      }

      toast.success(json.message || "Stock added successfully.");
      setStockDialogOpen(false);
      await loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add stock.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(product: BodegaProductItem) {
    const confirmed = window.confirm(`Delete ${product.name}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/bodega-products/${product._id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete bodega product.");
      }

      toast.success(json.message || "Bodega product deleted successfully.");
      await loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete bodega product.");
    }
  }

  function applySearch() {
    setSearch(draftSearch.trim());
    setPage(1);
  }

  function resetFilters() {
    setDraftSearch("");
    setSearch("");
    setCategoryId("ALL");
    setPage(1);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bodega Products</h1>
          <p className="text-sm text-muted-foreground">
            Owner-friendly stock display: packs and loose pcs are calculated from total PCS.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:p-5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(8rem,0.65fr)_minmax(12rem,0.9fr)] md:items-end">
          <div className="min-w-0 space-y-1.5">
            <Label>Search Product</Label>
            <Input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Enter keyword..."
              onKeyDown={(event) => {
                if (event.key === "Enter") applySearch();
              }}
            />
          </div>

          <div className="min-w-0 space-y-1.5">
            <Label>Category</Label>
            <Select
              value={categoryId}
              onValueChange={(value) => {
                setCategoryId(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category._id} value={category._id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1.5">
            <Label>Show entries</Label>
            <Select
              value={limit}
              onValueChange={(value) => {
                setLimit(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
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

          <div className="flex min-w-0 items-end gap-2">
            <Button onClick={applySearch} className="flex-1">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button variant="secondary" onClick={resetFilters} className="shrink-0">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Bodega Products</CardTitle>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-black hover:bg-black">
                  <TableHead className="text-white">Product Name</TableHead>
                  <TableHead className="text-white">Category</TableHead>
                  <TableHead className="text-right text-white">
                    Stock Summary
                  </TableHead>
                  <TableHead className="text-right text-white">
                    Buying Price
                  </TableHead>
                  <TableHead className="text-right text-white">
                    Price / PCS
                  </TableHead>
                  <TableHead className="text-right text-white">
                    Price / Pack
                  </TableHead>
                  <TableHead className="text-center text-white">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No bodega products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product._id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.categoryName || "-"}</TableCell>
                      <TableCell>{renderStockSummary(product)}</TableCell>
                      <TableCell className="text-right">{formatPeso(product.buyingPrice)}</TableCell>
                      <TableCell className="text-right">
                        {product.isPackProduct ? formatPeso(product.pricePerPcs || 0) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.isPackProduct
                          ? formatPeso(product.pricePerPack || 0)
                          : formatPeso(product.sellingPrice)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button size="icon" variant="outline" onClick={() => openStockDialog(product)}>
                            <PackagePlus className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" onClick={() => openEditDialog(product)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="destructive" onClick={() => handleDelete(product)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {products.length} of {meta.total} records</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
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
                size="sm"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Bodega Product" : "Add Bodega Product"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Product Name</Label>
              <Input
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="e.g. C10"
                required
              />
            </div>

            <div>
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(value) => updateForm("categoryId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No Category</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category._id} value={category._id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Stock QTY</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stockQty}
                  onChange={(event) => updateForm("stockQty", event.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  For sliced products, enter total PCS. Packs are calculated from Standard PCS & Packs.
                </p>
              </div>

              <div>
                <Label>Buying Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.buyingPrice}
                  onChange={(event) => updateForm("buyingPrice", event.target.value)}
                />
              </div>

              <div>
                <Label>Selling Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={(event) => updateForm("sellingPrice", event.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  For sliced products, this is price per pack.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock: {stockProduct?.name}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleStockIn} className="space-y-4">
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={stockForm.quantity}
                onChange={(event) => updateStockForm("quantity", event.target.value)}
              />
              {stockProduct?.isPackProduct ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter PCS. Example: 30 pcs now plus 20 pcs later becomes 1 full pack automatically.
                </p>
              ) : null}
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={stockForm.remarks}
                onChange={(event) => updateStockForm("remarks", event.target.value)}
                placeholder="Optional remarks"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStockDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Adding..." : "Add Stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

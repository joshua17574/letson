"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
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

type ProductOption = {
  _id: string;
  name: string;
};

type StandardPacking = {
  _id: string;
  wholeChickenId: string;
  wholeChickenName: string;
  productId: string;
  productName: string;
  standardPacking: number;
  standardSlice: number;
  chickenSizeType: string;
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const emptyForm = {
  wholeChickenId: "",
  productId: "",
  standardPacking: "0",
  standardSlice: "0",
  chickenSizeType: "-",
};

export function StandardPackingPageClient() {
  const [records, setRecords] = useState<StandardPacking[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [meta, setMeta] = useState<ApiMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState("50");
  const [chickenSizeType, setChickenSizeType] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StandardPacking | null>(
    null
  );
  const [form, setForm] = useState(emptyForm);

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

    if (chickenSizeType !== "ALL") {
      params.set("chickenSizeType", chickenSizeType);
    }

    try {
      const res = await fetch(`/api/slicing-standards?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load standard packing.");
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
          : "Failed to load standard packing."
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
  }, [page, limit, chickenSizeType]);

  function updateForm(name: keyof typeof emptyForm, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openCreateDialog() {
    setEditingRecord(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(record: StandardPacking) {
    setEditingRecord(record);
    setForm({
      wholeChickenId: record.wholeChickenId,
      productId: record.productId,
      standardPacking: String(record.standardPacking),
      standardSlice: String(record.standardSlice),
      chickenSizeType: record.chickenSizeType || "-",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const url = editingRecord
        ? `/api/slicing-standards/${editingRecord._id}`
        : "/api/slicing-standards";

      const res = await fetch(url, {
        method: editingRecord ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save standard packing.");
      }

      toast.success(json.message || "Standard packing saved successfully.");
      setDialogOpen(false);
      await loadRecords();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save standard packing."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record: StandardPacking) {
    const confirmed = window.confirm(
      `Delete standard ${record.wholeChickenName} → ${record.productName}?`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/slicing-standards/${record._id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete standard packing.");
      }

      toast.success(json.message || "Standard packing deleted successfully.");
      await loadRecords();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete standard packing."
      );
    }
  }

  function resetFilters() {
    setChickenSizeType("ALL");
    setPage(1);
  }

  const chickenSizeOptions = Array.from(
    new Set(
      records
        .map((record) => record.chickenSizeType)
        .filter((value) => value && value !== "-")
    )
  );

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Standard Packing
      </h1>

      <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm lg:flex-row lg:items-end">
        <div className="w-full lg:w-64">
          <Label>Filter by Chicken Size</Label>
          <Select
            value={chickenSizeType}
            onValueChange={(value) => {
              setChickenSizeType(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {chickenSizeOptions.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full lg:w-36">
          <Label>Show entries</Label>
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

        <Button variant="outline" onClick={resetFilters}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>All Standard Packing Records</CardTitle>

          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add New
          </Button>
        </CardHeader>

        <CardContent className="p-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-slate-900">
                <TableRow>
                  <TableHead className="text-center text-white">Whole Chicken</TableHead>
                  <TableHead className="text-center text-white">Product</TableHead>
                  <TableHead className="text-center text-white">
                    Standard Packing
                  </TableHead>
                  <TableHead className="text-center text-white">
                    Standard Slice
                  </TableHead>
                  <TableHead className="text-center text-white">
                    Chicken Size Type
                  </TableHead>
                  <TableHead className="text-center text-white">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No standard packing records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record._id}>
                      <TableCell className="text-center">
                        {record.wholeChickenName}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.productName}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.standardPacking.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.standardSlice}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.chickenSizeType || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="icon"
                            className="bg-yellow-500 text-black hover:bg-yellow-600"
                            onClick={() => openEditDialog(record)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => handleDelete(record)}
                          >
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? "Edit Standard Packing" : "Add Standard Packing"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Whole Chicken</Label>
              <Select
                value={form.wholeChickenId}
                onValueChange={(value) => updateForm("wholeChickenId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select whole chicken" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={form.productId}
                onValueChange={(value) => updateForm("productId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Standard Packing</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.standardPacking}
                onChange={(event) =>
                  updateForm("standardPacking", event.target.value)
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Standard Slice</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.standardSlice}
                onChange={(event) =>
                  updateForm("standardSlice", event.target.value)
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Chicken Size Type</Label>
              <Input
                value={form.chickenSizeType}
                onChange={(event) =>
                  updateForm("chickenSizeType", event.target.value)
                }
                placeholder="e.g. OS1, PS3, C1"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
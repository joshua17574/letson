"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

type CategoryOption = {
  _id: string;
  name: string;
};

type ProductOption = {
  _id: string;
  name: string;
};

type SaleLineItem = {
  _id: string;
  saleId: string;
  receiptNumber: string;
  saleDate?: string;
  customerName: string;
  source: "CHICKEN" | "BODEGA";
  categoryName: string;
  productName: string;
  qty: number;
  price: number;
  lineTotal: number;
  remarks: string;
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Summary = {
  rows: number;
  totalAmount: number;
};

export function SalesLinesPageClient() {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [lines, setLines] = useState<SaleLineItem[]>([]);

  const [summary, setSummary] = useState<Summary>({
    rows: 0,
    totalAmount: 0,
  });

  const [meta, setMeta] = useState<ApiMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });

  const [page, setPage] = useState(1);
  const [limit] = useState("50");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [customer, setCustomer] = useState("");

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: "",
    dateTo: "",
    receiptNumber: "",
    customer: "",
    categoryNames: "",
    productNames: "",
  });

  const [isLoading, setIsLoading] = useState(true);

  async function loadFilterOptions() {
    try {
      const [categoriesRes, productsRes, bodegaProductsRes] = await Promise.all([
        fetch("/api/categories?limit=100", { cache: "no-store" }),
        fetch("/api/products?limit=100", { cache: "no-store" }),
        fetch("/api/bodega-products?limit=100", { cache: "no-store" }),
      ]);

      const [categoriesJson, productsJson, bodegaProductsJson] =
        await Promise.all([
          categoriesRes.json(),
          productsRes.json(),
          bodegaProductsRes.json(),
        ]);

      if (categoriesRes.ok && categoriesJson.success) {
        setCategories(categoriesJson.data || []);
      }

      const productMap = new Map<string, ProductOption>();

      if (productsRes.ok && productsJson.success) {
        for (const item of productsJson.data || []) {
          productMap.set(item.name, {
            _id: item._id,
            name: item.name,
          });
        }
      }

      if (bodegaProductsRes.ok && bodegaProductsJson.success) {
        for (const item of bodegaProductsJson.data || []) {
          productMap.set(item.name, {
            _id: item._id,
            name: item.name,
          });
        }
      }

      setProducts(
        Array.from(productMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
    } catch {
      toast.error("Failed to load filter options.");
    }
  }

  async function loadLines() {
    setIsLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      limit,
    });

    if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
    if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);
    if (appliedFilters.receiptNumber) {
      params.set("receiptNumber", appliedFilters.receiptNumber);
    }
    if (appliedFilters.customer) params.set("customer", appliedFilters.customer);
    if (appliedFilters.categoryNames) {
      params.set("categoryNames", appliedFilters.categoryNames);
    }
    if (appliedFilters.productNames) {
      params.set("productNames", appliedFilters.productNames);
    }

    try {
      const res = await fetch(`/api/sales/lines?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load sales lines.");
      }

      setLines(json.data || []);
      setSummary(json.summary || { rows: 0, totalAmount: 0 });
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
        error instanceof Error ? error.message : "Failed to load sales lines."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadFilterOptions();
  }, []);

  useEffect(() => {
    void loadLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedFilters]);

  function toggleCategory(name: string) {
    setSelectedCategories((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]
    );
  }

  function toggleProduct(name: string) {
    setSelectedProducts((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]
    );
  }

  function applyFilters() {
    setAppliedFilters({
      dateFrom,
      dateTo,
      receiptNumber: receiptNumber.trim(),
      customer: customer.trim(),
      categoryNames: selectedCategories.join(","),
      productNames: selectedProducts.join(","),
    });
    setPage(1);
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setReceiptNumber("");
    setCustomer("");
    setSelectedCategories([]);
    setSelectedProducts([]);
    setAppliedFilters({
      dateFrom: "",
      dateTo: "",
      receiptNumber: "",
      customer: "",
      categoryNames: "",
      productNames: "",
    });
    setPage(1);
  }

  function formatDate(value?: string) {
    if (!value) return "—";
    return new Date(value).toISOString().slice(0, 10);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Sales Lines
      </h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>Summary of Sales (Whole + Bodega)</CardTitle>

          <div className="flex gap-2">
            <Button variant="outline" onClick={resetFilters}>
              Reset
            </Button>

            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <Label>Receipt Number</Label>
              <Input
                value={receiptNumber}
                onChange={(event) => setReceiptNumber(event.target.value)}
                placeholder="e.g. 2631"
              />
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <Input
                value={customer}
                onChange={(event) => setCustomer(event.target.value)}
                placeholder="e.g. Juan Dela Cruz"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="max-h-24 overflow-auto rounded-lg border p-3">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                {categories.map((category) => (
                  <label
                    key={category._id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedCategories.includes(category.name)}
                      onCheckedChange={() => toggleCategory(category.name)}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave all unchecked to include every category.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Product Name</Label>
            <div className="max-h-64 overflow-auto rounded-lg border p-3">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <label
                    key={`${product._id}-${product.name}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedProducts.includes(product.name)}
                      onCheckedChange={() => toggleProduct(product.name)}
                    />
                    {product.name}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave all unchecked to include every product.
            </p>
          </div>

          <Button onClick={applyFilters}>
            <Search className="mr-2 h-4 w-4" />
            Apply Filters
          </Button>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-md bg-blue-600 px-3 py-2 font-bold text-white">
              Rows: {summary.rows.toLocaleString()}
            </span>
            <span className="rounded-md bg-emerald-700 px-3 py-2 font-bold text-white">
              Total: {formatPeso(summary.totalAmount)}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-slate-900">
                <TableRow>
                  <TableHead className="text-white">Sale ID</TableHead>
                  <TableHead className="text-white">Receipt #</TableHead>
                  <TableHead className="text-white">Date</TableHead>
                  <TableHead className="text-white">Customer</TableHead>
                  <TableHead className="text-white">Source</TableHead>
                  <TableHead className="text-white">Category</TableHead>
                  <TableHead className="text-white">Product</TableHead>
                  <TableHead className="text-right text-white">Qty</TableHead>
                  <TableHead className="text-right text-white">Price</TableHead>
                  <TableHead className="text-right text-white">
                    Line Total
                  </TableHead>
                  <TableHead className="text-white">Remarks</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : lines.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No sales lines found.
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line) => (
                    <TableRow key={line._id}>
                      <TableCell>{line.saleId.slice(-6)}</TableCell>
                      <TableCell>{line.receiptNumber}</TableCell>
                      <TableCell>{formatDate(line.saleDate)}</TableCell>
                      <TableCell>{line.customerName}</TableCell>
                      <TableCell>
                        <span className="rounded bg-emerald-700 px-2 py-1 text-xs font-bold text-white">
                          {line.source === "BODEGA" ? "BODEGA" : "CHICKEN"}
                        </span>
                      </TableCell>
                      <TableCell>{line.categoryName}</TableCell>
                      <TableCell>{line.productName}</TableCell>
                      <TableCell className="text-right">
                        {line.qty.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.price.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.lineTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>{line.remarks || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {lines.length} of {meta.total} records
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
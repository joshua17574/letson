"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { formatPeso } from "@/lib/utils";

type CustomerOption = {
  _id: string;
  name: string;
};

type BodegaProductOption = {
  _id: string;
  name: string;
  stockQty: number;
  sellingPrice: number;
};

type SaleRow = {
  bodegaProductId: string;
  price: string;
  quantity: string;
};

const emptyRow: SaleRow = {
  bodegaProductId: "",
  price: "0",
  quantity: "0",
};

export function SaleGroceryPageClient() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<BodegaProductOption[]>([]);

  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");

  const [rows, setRows] = useState<SaleRow[]>([
    { ...emptyRow },
    { ...emptyRow },
    { ...emptyRow },
  ]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const total = useMemo(() => {
    return rows.reduce((sum, row) => {
      return sum + (Number(row.price) || 0) * (Number(row.quantity) || 0);
    }, 0);
  }, [rows]);

  async function loadCustomers() {
    const res = await fetch("/api/customers?limit=100", {
      cache: "no-store",
    });

    const json = await res.json();

    if (res.ok && json.success) {
      setCustomers(json.data || []);
    }
  }

  async function loadProducts() {
    const res = await fetch("/api/bodega-products?limit=100", {
      cache: "no-store",
    });

    const json = await res.json();

    if (res.ok && json.success) {
      setProducts(json.data || []);
    }
  }

  async function loadInitialData() {
    setIsLoading(true);

    try {
      await Promise.all([loadCustomers(), loadProducts()]);
    } catch {
      toast.error("Failed to load grocery sale data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  function updateRow(index: number, field: keyof SaleRow, value: string) {
    setRows((current) => {
      const next = [...current];

      next[index] = {
        ...next[index],
        [field]: value,
      };

      if (field === "bodegaProductId") {
        const product = products.find((item) => item._id === value);

        if (product) {
          next[index].price = String(product.sellingPrice || 0);
        }
      }

      return next;
    });
  }

  function addRow() {
    setRows((current) => [...current, { ...emptyRow }]);
  }

  function removeRow(index: number) {
    setRows((current) => {
      if (current.length === 1) return current;
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  }

  async function saveSale() {
    if (!saleDate) {
      toast.error("Date of sale is required.");
      return;
    }

    if (!customerId) {
      toast.error("Please select customer.");
      return;
    }

    if (!receiptNumber.trim()) {
      toast.error("Receipt number is required.");
      return;
    }

    const validRows = rows
      .filter((row) => row.bodegaProductId && Number(row.quantity) > 0)
      .map((row) => ({
        bodegaProductId: row.bodegaProductId,
        quantity: Number(row.quantity) || 0,
        price: Number(row.price) || 0,
      }));

    if (validRows.length === 0) {
      toast.error("Add at least one product.");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "BODEGA",
          customerId,
          saleDate,
          receiptNumber,
          items: validRows,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save sale.");
      }

      toast.success(json.message || "Sale saved successfully.");

      setCustomerId("");
      setReceiptNumber("");
      setRows([{ ...emptyRow }, { ...emptyRow }, { ...emptyRow }]);

      await loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save sale.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        New Sale
      </h1>

      <Card>
        <CardContent className="space-y-5 p-5">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Date of Sale</Label>
                <Input
                  type="date"
                  value={saleDate}
                  onChange={(event) => setSaleDate(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer._id} value={customer._id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Receipt Number</Label>
                <Input
                  value={receiptNumber}
                  onChange={(event) => setReceiptNumber(event.target.value)}
                  placeholder="e.g. 0002318"
                />
              </div>

              <div className="space-y-3">
                {rows.map((row, index) => {
                  const product = products.find(
                    (item) => item._id === row.bodegaProductId
                  );
                  const subtotal =
                    (Number(row.price) || 0) * (Number(row.quantity) || 0);

                  return (
                    <div
                      key={index}
                      className="grid gap-3 rounded-lg border bg-white p-3 md:grid-cols-[2fr_1fr_1fr_1.5fr_auto]"
                    >
                      <Select
                        value={row.bodegaProductId}
                        onValueChange={(value) =>
                          updateRow(index, "bodegaProductId", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((item) => (
                            <SelectItem key={item._id} value={item._id}>
                              {item.name} — Stock: {item.stockQty}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price}
                        onChange={(event) =>
                          updateRow(index, "price", event.target.value)
                        }
                        placeholder="Price"
                      />

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.quantity}
                        onChange={(event) =>
                          updateRow(index, "quantity", event.target.value)
                        }
                        placeholder="Qty"
                      />

                      <Input value={subtotal.toFixed(2)} disabled />

                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      {product ? (
                        <p className="text-xs text-muted-foreground md:col-span-5">
                          Available stock: {product.stockQty}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <p className="text-2xl font-semibold">Total: {formatPeso(total)}</p>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={addRow}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add More
              </Button>

              <div className="space-y-2">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={isSaving}
                  onClick={saveSale}
                >
                  {isSaving ? "Saving..." : "Save Sale"}
                </Button>

                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={isSaving}
                  onClick={() => {
                    setCustomerId("");
                    setReceiptNumber("");
                    setRows([{ ...emptyRow }, { ...emptyRow }, { ...emptyRow }]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
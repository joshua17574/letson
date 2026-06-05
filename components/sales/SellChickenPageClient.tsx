"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShoppingCart, Trash2 } from "lucide-react";
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
import { formatPeso } from "@/lib/utils";

type CustomerOption = {
  _id: string;
  name: string;
};

type ChickenProductOption = {
  _id: string;
  productId: string;
  bodegaProductId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  pricePerPack: number;
  pricePerPcs: number;
  packSize: number;
  stockPcs: number;
  availablePacks: number;
  loosePcs: number;
};

type CartItem = {
  productId: string;
  bodegaProductId: string;
  name: string;
  categoryName: string;
  availablePacks: number;
  loosePcs: number;
  packs: number;
  pricePerPack: number;
  pricePerPcs: number;
  packSize: number;
  stockPcsOut: number;
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function wholeNumber(value: unknown) {
  return Math.max(0, Math.trunc(numberValue(value)));
}

function formatWholeNumber(value: number | undefined) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

export function SellChickenPageClient() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ChickenProductOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiptNumber, setReceiptNumber] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [packs, setPacks] = useState("0");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedProduct = products.find((product) => product.productId === selectedProductId);

  const grandTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.packs * item.pricePerPack, 0);
  }, [cart]);

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
    const res = await fetch("/api/sales/chicken-products", {
      cache: "no-store",
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to load chicken products.");
    }

    setProducts(json.data || []);
  }

  async function loadInitialData() {
    setIsLoading(true);

    try {
      await Promise.all([loadCustomers(), loadProducts()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load sales data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  function addToCart() {
    if (!selectedProduct) {
      toast.error("Please select a product.");
      return;
    }

    const packsToSell = wholeNumber(packs);

    if (packsToSell <= 0) {
      toast.error("Packs must be greater than zero.");
      return;
    }

    if (selectedProduct.packSize <= 0) {
      toast.error("Pack size is not configured for this product.");
      return;
    }

    if (selectedProduct.pricePerPack <= 0) {
      toast.error("Price per pack is not configured for this product.");
      return;
    }

    const existing = cart.find((item) => item.bodegaProductId === selectedProduct.bodegaProductId);
    const currentPacks = existing?.packs || 0;
    const newTotalPacks = currentPacks + packsToSell;

    if (newTotalPacks > selectedProduct.availablePacks) {
      toast.error(`Not enough stock. Available packs: ${selectedProduct.availablePacks}.`);
      return;
    }

    const stockPcsOut = packsToSell * selectedProduct.packSize;

    if (existing) {
      setCart((current) =>
        current.map((item) =>
          item.bodegaProductId === selectedProduct.bodegaProductId
            ? {
                ...item,
                packs: newTotalPacks,
                stockPcsOut: newTotalPacks * item.packSize,
              }
            : item
        )
      );
    } else {
      setCart((current) => [
        ...current,
        {
          productId: selectedProduct.productId,
          bodegaProductId: selectedProduct.bodegaProductId,
          name: selectedProduct.name,
          categoryName: selectedProduct.categoryName,
          availablePacks: selectedProduct.availablePacks,
          loosePcs: selectedProduct.loosePcs,
          packs: packsToSell,
          pricePerPack: selectedProduct.pricePerPack,
          pricePerPcs: selectedProduct.pricePerPcs,
          packSize: selectedProduct.packSize,
          stockPcsOut,
        },
      ]);
    }

    setSelectedProductId("");
    setPacks("0");
  }

  function removeCartItem(bodegaProductId: string) {
    setCart((current) => current.filter((item) => item.bodegaProductId !== bodegaProductId));
  }

  async function submitSale() {
    if (!customerId) {
      toast.error("Please select a customer.");
      return;
    }

    if (!receiptNumber.trim()) {
      toast.error("Receipt number is required.");
      return;
    }

    if (cart.length === 0) {
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
          source: "CHICKEN",
          customerId,
          saleDate,
          receiptNumber,
          items: cart.map((item) => ({
            productId: item.bodegaProductId,
            bodegaProductId: item.bodegaProductId,
            packs: item.packs,
            quantity: item.packs,
          })),
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to submit sale.");
      }

      toast.success(json.message || "Sale created successfully.");
      setCustomerId("");
      setReceiptNumber("");
      setSelectedProductId("");
      setPacks("0");
      setCart([]);
      await loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit sale.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sell Products</h1>
        <p className="text-sm text-muted-foreground">
          Sell sliced chicken by pack. Stock is deducted as packs multiplied by pack size.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sell Chicken</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Customer *</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
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

                <div>
                  <Label>Sale Date *</Label>
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={(event) => setSaleDate(event.target.value)}
                  />
                </div>

                <div>
                  <Label>Receipt Number *</Label>
                  <Input
                    value={receiptNumber}
                    onChange={(event) => setReceiptNumber(event.target.value)}
                    placeholder="e.g. 0002318"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Label>Product</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select chicken product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.productId} value={product.productId}>
                          {product.name} - {product.availablePacks} packs / {product.loosePcs} pcs loose
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Available / Price</Label>
                  <div className="rounded-md border px-3 py-2 text-sm">
                    {selectedProduct ? (
                      <>
                        <div className="font-semibold">
                          {formatWholeNumber(selectedProduct.availablePacks)} packs / {formatWholeNumber(selectedProduct.loosePcs)} pcs loose
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatWholeNumber(selectedProduct.stockPcs)} pcs total, {formatWholeNumber(selectedProduct.packSize)} pcs / pack
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPeso(selectedProduct.pricePerPack)} / pack, {formatPeso(selectedProduct.pricePerPcs)} / pcs
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Select product</span>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Packs to Sell</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={packs}
                      onChange={(event) => setPacks(event.target.value)}
                    />
                    <Button type="button" onClick={addToCart}>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Packs to Sell</TableHead>
                      <TableHead className="text-right">PCS Out</TableHead>
                      <TableHead className="text-right">Price / Pack</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                          No items yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cart.map((item, index) => (
                        <TableRow key={item.bodegaProductId}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.categoryName}</TableCell>
                          <TableCell className="text-right">
                            {formatWholeNumber(item.availablePacks)} packs / {formatWholeNumber(item.loosePcs)} pcs loose
                          </TableCell>
                          <TableCell className="text-right">{formatWholeNumber(item.packs)}</TableCell>
                          <TableCell className="text-right">
                            {formatWholeNumber(item.stockPcsOut)} pcs
                          </TableCell>
                          <TableCell className="text-right">{formatPeso(item.pricePerPack)}</TableCell>
                          <TableCell className="text-right">
                            {formatPeso(item.packs * item.pricePerPack)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeCartItem(item.bodegaProductId)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Grand Total</p>
                  <p className="text-2xl font-bold">{formatPeso(grandTotal)}</p>
                </div>
                <Button type="button" onClick={submitSale} disabled={isSaving || cart.length === 0}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Submit Sale
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

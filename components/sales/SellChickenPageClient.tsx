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
  isPackBased?: boolean;
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

function formatNumber(value: number) {
  return numberValue(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
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

  const selectedProduct = products.find(
    (product) => product.bodegaProductId === selectedProductId
  );

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
      toast.error(
        error instanceof Error ? error.message : "Failed to load sales data."
      );
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
      toast.error("Pack size is missing for this product.");
      return;
    }

    if (selectedProduct.pricePerPack <= 0) {
      toast.error(`Selling price per pack is missing for ${selectedProduct.name}.`);
      return;
    }

    const existing = cart.find(
      (item) => item.bodegaProductId === selectedProduct.bodegaProductId
    );
    const currentPacks = existing?.packs || 0;
    const newTotalPacks = currentPacks + packsToSell;

    if (newTotalPacks > selectedProduct.availablePacks) {
      toast.error(`Not enough stock. Available full packs: ${selectedProduct.availablePacks}.`);
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
    setCart((current) =>
      current.filter((item) => item.bodegaProductId !== bodegaProductId)
    );
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
      toast.error(
        error instanceof Error ? error.message : "Failed to submit sale."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sell Products</h1>
        <Button className="rounded-xl">
          <ShoppingCart className="mr-2 h-4 w-4" />
          Sell Chicken
        </Button>
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Create Sale</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="-- Select customer --" />
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
                  <Label>Sale Date *</Label>
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={(event) => setSaleDate(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Receipt Number *</Label>
                  <Input
                    value={receiptNumber}
                    onChange={(event) => setReceiptNumber(event.target.value)}
                    placeholder="e.g. 0002318"
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_1.8fr_0.7fr_0.7fr]">
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="-- Select bodega product --" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.bodegaProductId} value={product.bodegaProductId}>
                          {product.name} - {product.availablePacks} packs available
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Available / Price</Label>
                  <Input
                    readOnly
                    value={
                      selectedProduct
                        ? `${selectedProduct.availablePacks} packs + ${selectedProduct.loosePcs} loose pcs (${selectedProduct.stockPcs} pcs total) | ${formatPeso(selectedProduct.pricePerPack)}/pack | ${formatPeso(selectedProduct.pricePerPcs)}/pc`
                        : "0 packs available"
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Packs to Sell</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={packs}
                    onChange={(event) => setPacks(event.target.value)}
                  />
                </div>

                <div className="flex items-end">
                  <Button type="button" className="w-full" onClick={addToCart}>
                    <ShoppingCart className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow>
                      <TableHead className="text-white">#</TableHead>
                      <TableHead className="text-white">Product</TableHead>
                      <TableHead className="text-white">Category</TableHead>
                      <TableHead className="text-right text-white">Available Packs</TableHead>
                      <TableHead className="text-right text-white">Packs to Sell</TableHead>
                      <TableHead className="text-right text-white">PCS Out</TableHead>
                      <TableHead className="text-right text-white">Price / Pack</TableHead>
                      <TableHead className="text-right text-white">Price / PCS</TableHead>
                      <TableHead className="text-right text-white">Line Total</TableHead>
                      <TableHead className="text-center text-white">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
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
                            {item.availablePacks.toLocaleString()} packs
                            {item.loosePcs > 0 ? ` + ${item.loosePcs} pcs` : ""}
                          </TableCell>
                          <TableCell className="text-right">{item.packs.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.stockPcsOut.toLocaleString()} pcs</TableCell>
                          <TableCell className="text-right">{formatPeso(item.pricePerPack)}</TableCell>
                          <TableCell className="text-right">{formatPeso(item.pricePerPcs)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPeso(item.packs * item.pricePerPack)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              onClick={() => removeCartItem(item.bodegaProductId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="text-2xl font-bold">
                  Grand Total: {formatPeso(grandTotal)}
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

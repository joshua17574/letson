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

type BodegaProductApiItem = {
  _id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  sellingPrice?: number;
  price?: number;
  pricePerPack?: number;
  packSize?: number;
  standardPacking?: number;
  stockQty?: number;
  stockPcs?: number;
};

type ChickenProductOption = {
  _id: string;
  productId: string;
  bodegaProductId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  pricePerPack: number;
  packSize: number;
  stockQty: number;
  availablePacks: number;
};

type CartItem = {
  productId: string;
  bodegaProductId: string;
  name: string;
  categoryName: string;
  availablePacks: number;
  packs: number;
  pricePerPack: number;
  packSize: number;
};

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
    (product) => product.productId === selectedProductId
  );

  const grandTotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + item.packs * item.pricePerPack,
      0
    );
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
    const res = await fetch("/api/bodega-products?limit=1000", {
      cache: "no-store",
    });

    const json = await res.json();

    if (res.ok && json.success) {
      const mappedProducts: ChickenProductOption[] = (
        json.data || []
      ).map((item: BodegaProductApiItem) => {
        const stockQty = Number(item.stockQty ?? item.stockPcs ?? 0);
        const packSize = Number(item.packSize ?? item.standardPacking ?? 1) || 1;
        const pricePerPack = Number(
          item.sellingPrice ?? item.pricePerPack ?? item.price ?? 0
        );

        return {
          _id: item._id,
          productId: item._id,
          bodegaProductId: item._id,
          name: item.name,
          categoryId: item.categoryId || "",
          categoryName: item.categoryName || "Uncategorized",
          pricePerPack,
          packSize,
          stockQty,
          availablePacks: stockQty,
        };
      });

      setProducts(mappedProducts);
    }
  }

  async function loadInitialData() {
    setIsLoading(true);

    try {
      await Promise.all([loadCustomers(), loadProducts()]);
    } catch {
      toast.error("Failed to load sales data.");
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

    const packsToSell = Number(packs) || 0;

    if (packsToSell <= 0) {
      toast.error("Packs must be greater than zero.");
      return;
    }

    const existing = cart.find(
      (item) => item.bodegaProductId === selectedProduct.bodegaProductId
    );

    const currentPacks = existing?.packs || 0;
    const newTotalPacks = currentPacks + packsToSell;

    if (newTotalPacks > selectedProduct.availablePacks) {
      toast.error(
        `Not enough stock. Available packs: ${selectedProduct.availablePacks}.`
      );
      return;
    }

    if (existing) {
      setCart((current) =>
        current.map((item) =>
          item.bodegaProductId === selectedProduct.bodegaProductId
            ? {
                ...item,
                packs: newTotalPacks,
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
          packs: packsToSell,
          pricePerPack: selectedProduct.pricePerPack,
          packSize: selectedProduct.packSize,
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
            pricePerPack: item.pricePerPack,
            price: item.pricePerPack,
            packSize: item.packSize,
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
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Sell Products
        </h1>

        <Button>
          <ShoppingCart className="mr-2 h-4 w-4" />
          Sell Chicken
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Create Sale</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
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

              <div className="grid gap-4 lg:grid-cols-[2fr_1.4fr_0.5fr_0.6fr]">
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="-- Select bodega product --" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem
                          key={product.bodegaProductId}
                          value={product.productId}
                        >
                          {product.name} — {product.availablePacks} available
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Available / Price</Label>
                  <Input
                    value={
                      selectedProduct
                        ? `${selectedProduct.availablePacks} available (${formatPeso(
                            selectedProduct.pricePerPack
                          )}/pack)`
                        : `0 available (${formatPeso(0)}/pack)`
                    }
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label>Packs / Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={packs}
                    onChange={(event) => setPacks(event.target.value)}
                  />
                </div>

                <div className="flex items-end">
                  <Button className="w-full" onClick={addToCart}>
                    <ShoppingCart className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-slate-900">
                    <TableRow>
                      <TableHead className="text-center text-white">#</TableHead>
                      <TableHead className="text-center text-white">
                        Product
                      </TableHead>
                      <TableHead className="text-center text-white">
                        Category
                      </TableHead>
                      <TableHead className="text-center text-white">
                        Available
                      </TableHead>
                      <TableHead className="text-center text-white">
                        Qty to Sell
                      </TableHead>
                      <TableHead className="text-center text-white">
                        Price
                      </TableHead>
                      <TableHead className="text-center text-white">
                        Line Total
                      </TableHead>
                      <TableHead className="text-center text-white">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {cart.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-20 text-center text-muted-foreground"
                        >
                          No items yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cart.map((item, index) => (
                        <TableRow key={item.bodegaProductId}>
                          <TableCell className="text-center">
                            {index + 1}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.name}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.categoryName}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.availablePacks}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.packs}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatPeso(item.pricePerPack)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatPeso(item.packs * item.pricePerPack)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
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

              <div className="flex flex-col items-end gap-3 sm:flex-row sm:justify-end">
                <p className="text-xl font-bold">
                  Grand Total: {formatPeso(grandTotal)}
                </p>

                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={isSaving || cart.length === 0}
                  onClick={submitSale}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Submit Sale
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
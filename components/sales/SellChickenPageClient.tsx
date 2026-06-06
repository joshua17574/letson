"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, PackageCheck, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ErpEmptyState,
  ErpField,
  ErpKeyValue,
  ErpMetricCard,
  ErpMobileCard,
  ErpPage,
  ErpPageHeader,
  ErpSection,
} from "@/components/erp/ErpShell";
import { formatWholeNumber, numberValue, PackStockDisplay, wholeNumber } from "@/components/erp/StockDisplay";
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
  categoryId?: string;
  categoryName?: string;
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
  categoryName?: string;
  availablePacks: number;
  loosePcs: number;
  packs: number;
  pricePerPack: number;
  pricePerPcs: number;
  packSize: number;
  stockPcsOut: number;
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

  const selectedProduct = products.find((product) => product.productId === selectedProductId || product.bodegaProductId === selectedProductId);

  const totals = useMemo(() => {
    return cart.reduce(
      (sum, item) => ({
        packs: sum.packs + item.packs,
        pcsOut: sum.pcsOut + item.stockPcsOut,
        grandTotal: sum.grandTotal + item.packs * item.pricePerPack,
      }),
      { packs: 0, pcsOut: 0, grandTotal: 0 }
    );
  }, [cart]);

  async function loadCustomers() {
    const res = await fetch("/api/customers?limit=100", { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) setCustomers(json.data || []);
  }

  async function loadProducts() {
    const res = await fetch("/api/sales/chicken-products", { cache: "no-store" });
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

    if (numberValue(selectedProduct.packSize) <= 0) {
      toast.error("Pack size is not configured for this product.");
      return;
    }

    if (numberValue(selectedProduct.pricePerPack) <= 0) {
      toast.error("Price per pack is not configured for this product.");
      return;
    }

    const existing = cart.find((item) => item.bodegaProductId === selectedProduct.bodegaProductId);
    const currentPacks = existing?.packs || 0;
    const newTotalPacks = currentPacks + packsToSell;

    if (newTotalPacks > selectedProduct.availablePacks) {
      toast.error(`Not enough stock. Available full packs: ${selectedProduct.availablePacks}.`);
      return;
    }

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
          stockPcsOut: packsToSell * selectedProduct.packSize,
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
        headers: { "Content-Type": "application/json" },
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
    <ErpPage>
      <ErpPageHeader
        eyebrow="Sales Desk"
        title="Sell Chicken"
        description="Pack-based chicken sales. Cashiers enter packs to sell, while the system deducts PCS using the configured pack size."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <ErpMetricCard
          label="Cart Packs"
          value={formatWholeNumber(totals.packs)}
          description="Full packs to sell"
          tone="blue"
          icon={<PackageCheck className="h-5 w-5" />}
        />
        <ErpMetricCard
          label="PCS Out"
          value={formatWholeNumber(totals.pcsOut)}
          description="Inventory deduction"
          tone="violet"
        />
        <ErpMetricCard
          label="Grand Total"
          value={formatPeso(totals.grandTotal)}
          description="Server still confirms DB price on save"
          tone="emerald"
        />
      </div>

      {isLoading ? (
        <ErpSection>
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
          </div>
        </ErpSection>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
          <div className="space-y-5">
            <ErpSection title="Sale Details" description="Choose customer, receipt, product, and number of packs.">
              <div className="grid gap-4 md:grid-cols-3">
                <ErpField label="Customer *">
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
                </ErpField>
                <ErpField label="Sale Date *">
                  <Input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} />
                </ErpField>
                <ErpField label="Receipt Number *">
                  <Input value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value)} placeholder="e.g. 0002318" />
                </ErpField>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr_auto]">
                <ErpField label="Product">
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select chicken product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.bodegaProductId} value={product.bodegaProductId}>
                          {product.name} - {formatWholeNumber(product.availablePacks)} packs / {formatWholeNumber(product.loosePcs)} pcs loose
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ErpField>
                <ErpField label="Packs to Sell">
                  <Input type="number" min="0" step="1" value={packs} onChange={(event) => setPacks(event.target.value)} />
                </ErpField>
                <div className="flex items-end">
                  <Button type="button" className="h-10 w-full lg:w-auto" onClick={addToCart}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>

              {selectedProduct ? (
                <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Available Stock</p>
                    <PackStockDisplay stockPcs={selectedProduct.stockPcs} packSize={selectedProduct.packSize} />
                  </div>
                  <ErpKeyValue label="Price / Pack" value={formatPeso(selectedProduct.pricePerPack)} />
                  <ErpKeyValue label="Price / PCS" value={formatPeso(selectedProduct.pricePerPcs)} />
                </div>
              ) : null}
            </ErpSection>

            <ErpSection title="Cart Items" description="Review packs and inventory PCS deduction before submitting.">
              {cart.length === 0 ? (
                <ErpEmptyState title="No items yet" description="Select a product and add packs to sell." />
              ) : (
                <>
                  <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
                    <Table>
                      <TableHeader className="bg-slate-950">
                        <TableRow>
                          <TableHead className="text-white">#</TableHead>
                          <TableHead className="text-white">Product</TableHead>
                          <TableHead className="text-white">Category</TableHead>
                          <TableHead className="text-white">Available</TableHead>
                          <TableHead className="text-right text-white">Packs</TableHead>
                          <TableHead className="text-right text-white">PCS Out</TableHead>
                          <TableHead className="text-right text-white">Price / Pack</TableHead>
                          <TableHead className="text-right text-white">Line Total</TableHead>
                          <TableHead className="text-center text-white">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.map((item, index) => (
                          <TableRow key={item.bodegaProductId}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-bold text-slate-950">{item.name}</TableCell>
                            <TableCell>{item.categoryName || "-"}</TableCell>
                            <TableCell>
                              {formatWholeNumber(item.availablePacks)} packs / {formatWholeNumber(item.loosePcs)} pcs loose
                            </TableCell>
                            <TableCell className="text-right font-bold">{formatWholeNumber(item.packs)}</TableCell>
                            <TableCell className="text-right">{formatWholeNumber(item.stockPcsOut)} pcs</TableCell>
                            <TableCell className="text-right">{formatPeso(item.pricePerPack)}</TableCell>
                            <TableCell className="text-right font-bold">{formatPeso(item.packs * item.pricePerPack)}</TableCell>
                            <TableCell className="text-center">
                              <Button size="icon" variant="destructive" onClick={() => removeCartItem(item.bodegaProductId)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {cart.map((item) => (
                      <ErpMobileCard key={item.bodegaProductId}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black text-slate-950">{item.name}</h3>
                            <p className="text-sm text-slate-500">{item.categoryName || "-"}</p>
                          </div>
                          <Button size="icon" variant="destructive" onClick={() => removeCartItem(item.bodegaProductId)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <ErpKeyValue label="Packs" value={formatWholeNumber(item.packs)} />
                          <ErpKeyValue label="PCS Out" value={`${formatWholeNumber(item.stockPcsOut)} pcs`} />
                          <ErpKeyValue label="Price / Pack" value={formatPeso(item.pricePerPack)} />
                          <ErpKeyValue label="Line Total" value={formatPeso(item.packs * item.pricePerPack)} />
                        </div>
                      </ErpMobileCard>
                    ))}
                  </div>
                </>
              )}
            </ErpSection>
          </div>

          <Card className="h-fit rounded-3xl border-slate-200 shadow-sm xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle className="text-base font-black">Checkout Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Grand Total</p>
                <p className="mt-2 text-3xl font-black">{formatPeso(totals.grandTotal)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ErpKeyValue label="Total Packs" value={formatWholeNumber(totals.packs)} />
                <ErpKeyValue label="PCS Out" value={`${formatWholeNumber(totals.pcsOut)} pcs`} />
              </div>
              <Button type="button" onClick={submitSale} disabled={isSaving || cart.length === 0} className="h-12 w-full rounded-2xl">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Submit Sale
              </Button>
              <p className="text-xs leading-5 text-slate-500">
                Staff sell by pack. Inventory is deducted as packs multiplied by pack size, while loose PCS remains available for future pack conversion.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </ErpPage>
  );
}

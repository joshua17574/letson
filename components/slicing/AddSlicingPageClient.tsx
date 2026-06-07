"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  Save,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type SlicingStandardOption = {
  _id: string;
  wholeChickenId: string;
  wholeChickenName: string;
  productId: string;
  productName: string;
  standardPacking: number;
  standardSlice: number;
  chickenSizeType?: string;
  availableStock: number;
};

type SlicingRow = {
  standardId: string;
  wholeChickenId: string;
  wholeChickenName: string;
  productId: string;
  productName: string;
  standardPacking: number;
  standardSlice: number;
  availableStock: number;
  bags: string;
  heads: string;
  kilos: string;
  actualSlicedPcs: string;
};

const emptyRow: SlicingRow = {
  standardId: "",
  wholeChickenId: "",
  wholeChickenName: "",
  productId: "",
  productName: "",
  standardPacking: 0,
  standardSlice: 0,
  availableStock: 0,
  bags: "0",
  heads: "0",
  kilos: "0",
  actualSlicedPcs: "0",
};

function numberValue(value: string | number | undefined | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercent(value: number) {
  return `${numberValue(value).toFixed(2)}%`;
}

function calculatePackBreakdown(actualPcsValue: number, standardPackingValue: number) {
  const actualPcs = Math.max(0, Math.trunc(numberValue(actualPcsValue)));
  const pcsPerPack = Math.max(0, Math.trunc(numberValue(standardPackingValue)));

  if (pcsPerPack <= 0) {
    return {
      pcsPerPack: 0,
      actualPacks: 0,
      packedPcs: 0,
      butal: actualPcs,
    };
  }

  const actualPacks = Math.floor(actualPcs / pcsPerPack);
  const packedPcs = actualPacks * pcsPerPack;
  const butal = actualPcs - packedPcs;

  return {
    pcsPerPack,
    actualPacks,
    packedPcs,
    butal,
  };
}

function calculateRow(row: SlicingRow) {
  const heads = numberValue(row.heads);
  const actualSlicedPcs = Math.max(0, Math.trunc(numberValue(row.actualSlicedPcs)));
  const standardSlice = numberValue(row.standardSlice);
  const standardPacking = numberValue(row.standardPacking);
  const totalStdPcs = heads * standardSlice;
  const packBreakdown = calculatePackBreakdown(actualSlicedPcs, standardPacking);
  const actualPacks = packBreakdown.actualPacks;
  const packedPcs = packBreakdown.packedPcs;
  const butal = packBreakdown.butal;
  const variance = actualSlicedPcs - totalStdPcs;
  const yieldRate = totalStdPcs > 0 ? (actualSlicedPcs / totalStdPcs) * 100 : 0;

  return {
    totalStdPcs,
    actualPacks,
    packedPcs,
    butal,
    variance,
    yieldRate,
  };
}

function ResultTile({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "success" | "danger";
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border bg-background/70 px-3 py-2.5 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--background)_72%,transparent)]",
        tone === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "danger" && "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <div className="text-xs font-medium leading-tight text-muted-foreground">
        {label}
      </div>
      <div className="tabular-value mt-1 truncate text-lg font-semibold leading-none">
        {value}
      </div>
      {helper ? (
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function StandardPicker({
  standards,
  value,
  onSelect,
}: {
  standards: SlicingStandardOption[];
  value: string;
  onSelect: (standard: SlicingStandardOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = standards.find((standard) => standard._id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selected ? (
            <span className="truncate">
              {selected.wholeChickenName} - {selected.productName}
            </span>
          ) : (
            "Select standard..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-2rem),420px)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search standard..." />
          <CommandList>
            <CommandEmpty>No standard found.</CommandEmpty>
            <CommandGroup>
              {standards.map((standard) => (
                <CommandItem
                  key={standard._id}
                  value={`${standard.wholeChickenName} ${standard.productName}`}
                  onSelect={() => {
                    onSelect(standard);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === standard._id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      {standard.wholeChickenName} - {standard.productName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Stock: {standard.availableStock} | Std Slice: {standard.standardSlice} pcs/head | Std Pack: {standard.standardPacking} pcs/pack
                    </span>
                    {standard.chickenSizeType ? (
                      <Badge variant="secondary" className="w-fit">
                        {standard.chickenSizeType}
                      </Badge>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AddSlicingPageClient() {
  const router = useRouter();
  const detailsId = useId();
  const [standards, setStandards] = useState<SlicingStandardOption[]>([]);
  const [slicingDate, setSlicingDate] = useState(new Date().toISOString().slice(0, 10));
  const [slicer, setSlicer] = useState("");
  const [packer, setPacker] = useState("");
  const [rows, setRows] = useState<SlicingRow[]>([{ ...emptyRow }]);
  const [isLoadingStandards, setIsLoadingStandards] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const totals = useMemo(() => {
    const rowTotals = rows.reduce(
      (sum, row) => {
        const computed = calculateRow(row);
        return {
          heads: sum.heads + numberValue(row.heads),
          kilos: sum.kilos + numberValue(row.kilos),
          totalStdPcs: sum.totalStdPcs + computed.totalStdPcs,
          actualSlicedPcs: sum.actualSlicedPcs + numberValue(row.actualSlicedPcs),
          packs: sum.packs + computed.actualPacks,
          packedPcs: sum.packedPcs + computed.packedPcs,
          butal: sum.butal + computed.butal,
          variance: sum.variance + computed.variance,
        };
      },
      {
        heads: 0,
        kilos: 0,
        totalStdPcs: 0,
        actualSlicedPcs: 0,
        packs: 0,
        packedPcs: 0,
        butal: 0,
        variance: 0,
      }
    );

    const yieldRate =
      rowTotals.totalStdPcs > 0
        ? (rowTotals.actualSlicedPcs / rowTotals.totalStdPcs) * 100
        : 0;

    return {
      ...rowTotals,
      yieldRate,
    };
  }, [rows]);

  async function loadStandards() {
    setIsLoadingStandards(true);

    try {
      const res = await fetch("/api/slicing/standards", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load slicing standards.");
      }

      setStandards(json.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load slicing standards.");
    } finally {
      setIsLoadingStandards(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStandards();
  }, []);

  function updateRow(index: number, field: keyof SlicingRow, value: string) {
    setRows((current) => {
      const next = [...current];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  }

  function selectStandard(index: number, standard: SlicingStandardOption) {
    setRows((current) => {
      const next = [...current];
      next[index] = {
        ...next[index],
        standardId: standard._id,
        wholeChickenId: standard.wholeChickenId,
        wholeChickenName: standard.wholeChickenName,
        productId: standard.productId,
        productName: standard.productName,
        standardPacking: numberValue(standard.standardPacking),
        standardSlice: numberValue(standard.standardSlice),
        availableStock: numberValue(standard.availableStock),
      };
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

  async function saveAll() {
    if (!slicingDate) {
      toast.error("Slicing date is required.");
      return;
    }

    if (!slicer.trim()) {
      toast.error("Slicer name is required.");
      return;
    }

    if (!packer.trim()) {
      toast.error("Packer name is required.");
      return;
    }

    const validRows = rows.filter(
      (row) => row.standardId && numberValue(row.heads) > 0 && numberValue(row.actualSlicedPcs) > 0
    );

    if (validRows.length === 0) {
      toast.error("Add at least one valid slicing row.");
      return;
    }

    for (const row of validRows) {
      const heads = numberValue(row.heads);
      if (heads > row.availableStock) {
        toast.error(`${row.wholeChickenName} only has ${row.availableStock} available stock.`);
        return;
      }
    }

    setIsSaving(true);

    try {
      const payload = {
        slicingDate,
        slicer,
        packer,
        items: validRows.map((row) => {
          const computed = calculateRow(row);
          return {
            standardId: row.standardId,
            wholeChickenId: row.wholeChickenId,
            mainProductId: row.wholeChickenId,
            productId: row.productId,
            slicedProductId: row.productId,
            bags: numberValue(row.bags),
            heads: numberValue(row.heads),
            qtyToSlice: numberValue(row.heads),
            kilos: numberValue(row.kilos),
            standardSlice: numberValue(row.standardSlice),
            standardPacking: numberValue(row.standardPacking),
            totalStdPcs: computed.totalStdPcs,
            actualSlicedPcs: numberValue(row.actualSlicedPcs),
            actualPacks: computed.actualPacks,
            butal: computed.butal,
            variance: computed.variance,
          };
        }),
      };

      const res = await fetch("/api/slicing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save slicing records.");
      }

      toast.success(json.message || "Slicing records saved successfully.");
      router.push("/slicing");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save slicing records.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="New Slicing Records"
        actions={
          <Button variant="outline" onClick={() => router.push("/slicing")}>
            Back to History
          </Button>
        }
      />

      <Card>
        <CardHeader className="border-b bg-muted/30 px-4 py-3 sm:px-5">
          <CardTitle className="font-semibold">Slicing Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
          <div className="min-w-0 space-y-2">
            <Label htmlFor={`${detailsId}-date`} className="font-semibold text-foreground">
              Slicing Date
            </Label>
            <Input
              id={`${detailsId}-date`}
              type="date"
              className="h-11 bg-background md:h-10 md:px-3"
              value={slicingDate}
              onChange={(event) => setSlicingDate(event.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor={`${detailsId}-slicer`} className="font-semibold text-foreground">
              Slicer
            </Label>
            <Input
              id={`${detailsId}-slicer`}
              className="h-11 bg-background md:h-10 md:px-3"
              value={slicer}
              onChange={(event) => setSlicer(event.target.value)}
              placeholder="Enter slicer name"
            />
          </div>
          <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-1">
            <Label htmlFor={`${detailsId}-packer`} className="font-semibold text-foreground">
              Packer
            </Label>
            <Input
              id={`${detailsId}-packer`}
              className="h-11 bg-background md:h-10 md:px-3"
              value={packer}
              onChange={(event) => setPacker(event.target.value)}
              placeholder="Enter packer name"
            />
          </div>
        </CardContent>
      </Card>

    
      <Card>
        <CardHeader>
          <CardTitle>Slicing Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingStandards ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row, index) => {
                const computed = calculateRow(row);
                const rowId = `slicing-item-${index}`;
                const varianceTone =
                  computed.variance < 0
                    ? "danger"
                    : computed.variance > 0
                      ? "success"
                      : undefined;

                return (
                  <div
                    key={index}
                    className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold">
                        Item #{index + 1}
                      </div>
                      {rows.length > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="shrink-0"
                          onClick={() => removeRow(index)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      ) : null}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
                      <div className="min-w-0 space-y-4">
                        <div className="space-y-1.5">
                          <Label>Standard</Label>
                          <StandardPicker
                            standards={standards}
                            value={row.standardId}
                            onSelect={(standard) =>
                              selectStandard(index, standard)
                            }
                          />
                          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>Available: {row.availableStock}</span>
                            <span>Slice: {row.standardSlice} pcs/head</span>
                            <span>Pack: {row.standardPacking} pcs/pack</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                          <div className="min-w-0 space-y-1.5">
                            <Label htmlFor={`${rowId}-bags`}>Bags</Label>
                            <Input
                              id={`${rowId}-bags`}
                              type="number"
                              min="0"
                              value={row.bags}
                              onChange={(event) =>
                                updateRow(index, "bags", event.target.value)
                              }
                            />
                          </div>
                          <div className="min-w-0 space-y-1.5">
                            <Label htmlFor={`${rowId}-heads`}>Heads</Label>
                            <Input
                              id={`${rowId}-heads`}
                              type="number"
                              min="0"
                              value={row.heads}
                              onChange={(event) =>
                                updateRow(index, "heads", event.target.value)
                              }
                            />
                          </div>
                          <div className="min-w-0 space-y-1.5">
                            <Label htmlFor={`${rowId}-kilos`}>Kilos</Label>
                            <Input
                              id={`${rowId}-kilos`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.kilos}
                              onChange={(event) =>
                                updateRow(index, "kilos", event.target.value)
                              }
                            />
                          </div>
                          <div className="min-w-0 space-y-1.5">
                            <Label htmlFor={`${rowId}-actual-pcs`}>
                              Actual Sliced PCS
                            </Label>
                            <Input
                              id={`${rowId}-actual-pcs`}
                              type="number"
                              min="0"
                              value={row.actualSlicedPcs}
                              onChange={(event) =>
                                updateRow(
                                  index,
                                  "actualSlicedPcs",
                                  event.target.value
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border bg-muted/35 p-3">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
                          <ResultTile
                            label="Std PCS"
                            value={computed.totalStdPcs}
                          />
                          <ResultTile
                            label="Full Packs"
                            value={computed.actualPacks}
                            helper={
                              row.standardPacking > 0
                                ? `${row.standardPacking} pcs / pack`
                                : "Select standard"
                            }
                          />
                          <ResultTile
                            label="Loose PCS"
                            value={computed.butal}
                          />
                          <ResultTile
                            label="Variance"
                            value={computed.variance}
                            tone={varianceTone}
                          />
                          <ResultTile
                            label="Yield Rate"
                            value={formatPercent(computed.yieldRate)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Button type="button" variant="secondary" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </Button>

          <div className="rounded-xl border bg-slate-50 p-4 text-sm">
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
              <div>Total Heads: {totals.heads.toLocaleString()}</div>
              <div>Total Kilos: {totals.kilos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div>Total Std PCS: {totals.totalStdPcs.toLocaleString()}</div>
              <div>Total Actual PCS: {totals.actualSlicedPcs.toLocaleString()}</div>
              <div>Total Packs: {totals.packs.toLocaleString()}</div>
              <div>Total Butal: {totals.butal.toLocaleString()}</div>
              <div>Total Variance: {totals.variance.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/slicing")}>
              Cancel
            </Button>
            <Button type="button" onClick={saveAll} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save All
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

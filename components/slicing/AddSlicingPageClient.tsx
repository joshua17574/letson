"use client";

import { useEffect, useMemo, useState } from "react";
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
};

type SlicingRow = {
  standardId: string;
  wholeChickenId: string;
  wholeChickenName: string;
  productId: string;
  productName: string;
  standardPacking: number;
  standardSlice: number;

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

  bags: "0",
  heads: "0",
  kilos: "0",
  actualSlicedPcs: "0",
};

function numberValue(value: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateRow(row: SlicingRow) {
  const heads = numberValue(row.heads);
  const actualSlicedPcs = numberValue(row.actualSlicedPcs);
  const standardSlice = numberValue(row.standardSlice);
  const standardPacking = numberValue(row.standardPacking);

  const totalStdPcs = heads * standardSlice;
  const actualPacks =
    standardPacking > 0 ? Math.floor(actualSlicedPcs / standardPacking) : 0;
  const butal = standardPacking > 0 ? actualSlicedPcs % standardPacking : 0;
  const variance = actualSlicedPcs - totalStdPcs;

  return {
    totalStdPcs,
    actualPacks,
    butal,
    variance,
  };
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
          type="button"
          variant="outline"
          role="combobox"
          className="h-11 w-full justify-between bg-white"
        >
          {selected ? (
            <span className="truncate">
              {selected.wholeChickenName} → {selected.productName}
            </span>
          ) : (
            <span className="text-muted-foreground">Select standard...</span>
          )}

          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[520px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search standard, whole chicken, product..." />
          <CommandList>
            <CommandEmpty>No standard found.</CommandEmpty>

            <CommandGroup>
              {standards.map((standard) => (
                <CommandItem
                  key={standard._id}
                  value={`${standard.wholeChickenName} ${standard.productName} ${standard.chickenSizeType || ""}`}
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

                  <div className="flex flex-1 flex-col gap-1">
                    <div className="font-semibold">
                      {standard.wholeChickenName} → {standard.productName}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">
                        Std Slice: {standard.standardSlice}
                      </Badge>
                      <Badge variant="secondary">
                        Std Pack: {standard.standardPacking}
                      </Badge>
                      {standard.chickenSizeType ? (
                        <Badge variant="outline">
                          {standard.chickenSizeType}
                        </Badge>
                      ) : null}
                    </div>
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

  const [standards, setStandards] = useState<SlicingStandardOption[]>([]);
  const [slicingDate, setSlicingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [slicer, setSlicer] = useState("");
  const [packer, setPacker] = useState("");

  const [rows, setRows] = useState<SlicingRow[]>([{ ...emptyRow }]);

  const [isLoadingStandards, setIsLoadingStandards] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const totals = useMemo(() => {
    return rows.reduce(
      (sum, row) => {
        const computed = calculateRow(row);

        return {
          heads: sum.heads + numberValue(row.heads),
          kilos: sum.kilos + numberValue(row.kilos),
          totalStdPcs: sum.totalStdPcs + computed.totalStdPcs,
          actualSlicedPcs:
            sum.actualSlicedPcs + numberValue(row.actualSlicedPcs),
          packs: sum.packs + computed.actualPacks,
          variance: sum.variance + computed.variance,
        };
      },
      {
        heads: 0,
        kilos: 0,
        totalStdPcs: 0,
        actualSlicedPcs: 0,
        packs: 0,
        variance: 0,
      }
    );
  }, [rows]);

  async function loadStandards() {
    setIsLoadingStandards(true);

    try {
      const res = await fetch("/api/slicing/standards", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load slicing standards.");
      }

      setStandards(json.data || []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load slicing standards."
      );
    } finally {
      setIsLoadingStandards(false);
    }
  }

  useEffect(() => {
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
      (row) =>
        row.standardId &&
        numberValue(row.heads) > 0 &&
        numberValue(row.actualSlicedPcs) > 0
    );

    if (validRows.length === 0) {
      toast.error("Add at least one valid slicing row.");
      return;
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

      // Main product / whole chicken
      wholeChickenId: row.wholeChickenId,
      mainProductId: row.wholeChickenId,

      // Output / sliced product
      productId: row.productId,
      slicedProductId: row.productId,

      // Quantities
      bags: numberValue(row.bags),
      heads: numberValue(row.heads),
      qtyToSlice: numberValue(row.heads),
      kilos: numberValue(row.kilos),

      // Standards
      standardSlice: numberValue(row.standardSlice),
      standardPacking: numberValue(row.standardPacking),

      // Computed values
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
        headers: {
          "Content-Type": "application/json",
        },
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
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save slicing records."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Add New Slicing"
        description="Record multiple slicing entries and automatically calculate packs, butal, and variance."
        actions={
          <Button variant="secondary" onClick={() => router.push("/slicing")}>
            Back to History
          </Button>
        }
      />

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>New Slicing Records</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Slicing Date</Label>
              <Input
                type="date"
                value={slicingDate}
                onChange={(event) => setSlicingDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Slicer</Label>
              <Input
                value={slicer}
                onChange={(event) => setSlicer(event.target.value)}
                placeholder="Enter slicer name"
              />
            </div>

            <div className="space-y-2">
              <Label>Packer</Label>
              <Input
                value={packer}
                onChange={(event) => setPacker(event.target.value)}
                placeholder="Enter packer name"
              />
            </div>
          </div>

          {isLoadingStandards ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row, index) => {
                const computed = calculateRow(row);

                return (
                  <div
                    key={index}
                    className="rounded-2xl border-l-4 border-l-blue-600 bg-white p-4 shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="grid gap-4 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
                      <div className="space-y-2">
                        <Label>Standard</Label>
                        <StandardPicker
                          standards={standards}
                          value={row.standardId}
                          onSelect={(standard) =>
                            selectStandard(index, standard)
                          }
                        />

                        <div className="flex flex-wrap gap-2 pt-1">
                          <Badge variant="secondary">
                            Std Slice: {row.standardSlice}
                          </Badge>
                          <Badge variant="secondary">
                            Std Pack: {row.standardPacking}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Bags</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={row.bags}
                          onChange={(event) =>
                            updateRow(index, "bags", event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Heads</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={row.heads}
                          onChange={(event) =>
                            updateRow(index, "heads", event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Kilos</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.kilos}
                          onChange={(event) =>
                            updateRow(index, "kilos", event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Total Std. PCS</Label>
                        <Input value={computed.totalStdPcs} disabled />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
                      <div className="space-y-2">
                        <Label>Actual Sliced PCS</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
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

                      <div className="space-y-2">
                        <Label>Standard Packing</Label>
                        <Input value={row.standardPacking} disabled />
                      </div>

                      <div className="space-y-2">
                        <Label>Actual Packs</Label>
                        <Input value={computed.actualPacks} disabled />
                      </div>

                      <div className="space-y-2">
                        <Label>Butal</Label>
                        <Input value={computed.butal} disabled />
                      </div>

                      <div className="space-y-2">
                        <Label>Variance</Label>
                        <Input
                          value={computed.variance}
                          disabled
                          className={
                            computed.variance < 0
                              ? "font-bold text-rose-600"
                              : computed.variance > 0
                                ? "font-bold text-emerald-700"
                                : ""
                          }
                        />
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => removeRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            className="w-full rounded-xl"
            onClick={addRow}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </Button>

          <div className="flex flex-wrap gap-3 rounded-2xl bg-slate-50 p-4">
            <Badge variant="outline" className="px-4 py-2 text-sm">
              Total Heads: {totals.heads.toLocaleString()}
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm">
              Total Kilos: {totals.kilos.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm">
              Total Std PCS: {totals.totalStdPcs.toLocaleString()}
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm">
              Total Actual PCS: {totals.actualSlicedPcs.toLocaleString()}
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm">
              Total Packs: {totals.packs.toLocaleString()}
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm">
              Total Variance: {totals.variance.toLocaleString()}
            </Badge>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={() => router.push("/slicing")}
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
              onClick={saveAll}
            >
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
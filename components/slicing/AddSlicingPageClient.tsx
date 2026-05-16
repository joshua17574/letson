"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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

type StandardOption = {
  _id: string;
  wholeChickenId: string;
  wholeChickenName: string;
  productId: string;
  productName: string;
  standardPacking: number;
  standardSlice: number;
  chickenSizeType: string;
};

type SlicingRow = {
  standardId: string;
  bags: string;
  heads: string;
  kilos: string;
  actualSlicedPcs: string;
};

const emptyRow: SlicingRow = {
  standardId: "",
  bags: "0",
  heads: "0",
  kilos: "0",
  actualSlicedPcs: "0",
};

export function AddSlicingPageClient() {
  const router = useRouter();

  const [standards, setStandards] = useState<StandardOption[]>([]);

  const [slicingDate, setSlicingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [slicer, setSlicer] = useState("");
  const [packer, setPacker] = useState("");

  const [rows, setRows] = useState<SlicingRow[]>([{ ...emptyRow }]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadStandards() {
    setIsLoading(true);

    try {
      const res = await fetch("/api/slicing-standards?limit=100", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load standards.");
      }

      setStandards(json.data || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load standards."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadStandards();
  }, []);

  function findStandard(standardId: string) {
    return standards.find((standard) => standard._id === standardId);
  }

  function computeRow(row: SlicingRow) {
    const standard = findStandard(row.standardId);

    const heads = Number(row.heads) || 0;
    const actualSlicedPcs = Number(row.actualSlicedPcs) || 0;

    const standardSlice = standard?.standardSlice || 0;
    const standardPacking = standard?.standardPacking || 0;

    const totalStdPcs = heads * standardSlice;
    const actualPacks =
      standardPacking > 0 ? Math.floor(actualSlicedPcs / standardPacking) : 0;
    const butal =
      standardPacking > 0 ? actualSlicedPcs % standardPacking : 0;
    const variance = actualSlicedPcs - totalStdPcs;

    return {
      standard,
      standardSlice,
      standardPacking,
      totalStdPcs,
      actualPacks,
      butal,
      variance,
    };
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (sum, row) => {
        const computed = computeRow(row);

        return {
          heads: sum.heads + (Number(row.heads) || 0),
          kilos: sum.kilos + (Number(row.kilos) || 0),
          stdPcs: sum.stdPcs + computed.totalStdPcs,
          actualPcs: sum.actualPcs + (Number(row.actualSlicedPcs) || 0),
          packs: sum.packs + computed.actualPacks,
          variance: sum.variance + computed.variance,
        };
      },
      {
        heads: 0,
        kilos: 0,
        stdPcs: 0,
        actualPcs: 0,
        packs: 0,
        variance: 0,
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, standards]);

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

  function addRow() {
    setRows((current) => [...current, { ...emptyRow }]);
  }

  function removeRow(index: number) {
    setRows((current) => {
      if (current.length === 1) return current;
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validRows = rows
      .filter(
        (row) =>
          row.standardId &&
          Number(row.heads) > 0 &&
          Number(row.actualSlicedPcs) > 0
      )
      .map((row) => ({
        standardId: row.standardId,
        bags: Number(row.bags) || 0,
        heads: Number(row.heads) || 0,
        kilos: Number(row.kilos) || 0,
        actualSlicedPcs: Number(row.actualSlicedPcs) || 0,
      }));

    if (validRows.length === 0) {
      toast.error("Add at least one valid slicing row.");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/slicing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slicingDate,
          slicer,
          packer,
          items: validRows,
        }),
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
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Add New Slicing (Multiple)
        </h1>

        <Button variant="outline" asChild>
          <Link href="/slicing">Back to History</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>New Slicing Records</CardTitle>
        </CardHeader>

        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Slicing Date</Label>
                <Input
                  type="date"
                  value={slicingDate}
                  onChange={(event) => setSlicingDate(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Slicer</Label>
                <Input
                  value={slicer}
                  onChange={(event) => setSlicer(event.target.value)}
                  placeholder="Enter slicer name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Packer</Label>
                <Input
                  value={packer}
                  onChange={(event) => setPacker(event.target.value)}
                  placeholder="Enter packer name"
                  required
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex h-40 items-center justify-center rounded-xl border">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {rows.map((row, index) => {
                  const computed = computeRow(row);

                  return (
                    <div
                      key={index}
                      className="rounded-xl border-l-4 border-l-blue-600 bg-white p-4 shadow-sm"
                    >
                      <div className="grid gap-4 lg:grid-cols-6">
                        <div className="space-y-2 lg:col-span-2">
                          <Label>Standard</Label>
                          <Select
                            value={row.standardId}
                            onValueChange={(value) =>
                              updateRow(index, "standardId", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="-- Select Standard --" />
                            </SelectTrigger>
                            <SelectContent>
                              {standards.map((standard) => (
                                <SelectItem
                                  key={standard._id}
                                  value={standard._id}
                                >
                                  {standard.wholeChickenName} →{" "}
                                  {standard.productName} | Slice:{" "}
                                  {standard.standardSlice} | Pack:{" "}
                                  {standard.standardPacking}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span>
                              Std Slice (pcs/head):{" "}
                              <strong>{computed.standardSlice}</strong>
                            </span>
                            <span>
                              Std Pack (pcs/pack):{" "}
                              <strong>{computed.standardPacking}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Bags</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
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
                            step="0.01"
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

                      <div className="mt-4 grid gap-4 lg:grid-cols-6">
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
                          <Input value={computed.standardPacking} disabled />
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
                          <Input value={computed.variance} disabled />
                        </div>

                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => removeRow(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <Button type="button" variant="secondary" onClick={addRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Row
                </Button>
              </div>
            )}

            <div className="grid gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-lg bg-slate-50 p-3">
                Total Heads: <strong>{totals.heads}</strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                Total Kilos: <strong>{totals.kilos.toFixed(2)}</strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                Total Std PCS: <strong>{totals.stdPcs}</strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                Total Actual PCS: <strong>{totals.actualPcs}</strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                Total Packs: <strong>{totals.packs}</strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                Total Variance: <strong>{totals.variance}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" asChild>
                <Link href="/slicing">Cancel</Link>
              </Button>

              <Button type="submit" disabled={isSaving || isLoading}>
                {isSaving ? "Saving..." : "Save All"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
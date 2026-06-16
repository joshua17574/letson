"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Row = {
  outletId: string;
  name: string;
  code: string;
  isActive: boolean;
  salesTotal: number;
  salesCount: number;
  expenseTotal: number;
  expenseCount: number;
  net: number;
};

type Totals = {
  salesTotal: number;
  expenseTotal: number;
  net: number;
  salesCount: number;
};

type Preset = "today" | "week" | "month" | "custom";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function OutletSummaryPageClient() {
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (preset === "custom") {
        if (!from || !to) {
          toast.error("Pick both a start and end date.");
          setLoading(false);
          return;
        }
        params.set("from", from);
        params.set("to", to);
      } else {
        params.set("preset", preset);
      }

      const res = await fetch(`/api/outlet-summary?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setRows(json.rows || []);
        setTotals(json.totals || null);
      } else {
        toast.error(json.message || "Failed to load summary.");
      }
    } catch {
      toast.error("Failed to load summary.");
    } finally {
      setLoading(false);
    }
  }, [preset, from, to]);

  // Auto-load for presets; custom waits for Apply.
  useEffect(() => {
    if (preset !== "custom") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const presetLabel: Record<Exclude<Preset, "custom">, string> = {
    today: "Today",
    week: "This Week",
    month: "This Month",
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-6 text-rose-600" />
          <h1 className="text-2xl font-black">Outlet Summary</h1>
        </div>
        <p className="text-sm text-slate-500">
          Sales, expenses, and net per outlet. Figures come from sales and
          expenses recorded on the cashier app.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        {(["today", "week", "month"] as const).map((p) => (
          <Button
            key={p}
            variant={preset === p ? "default" : "outline"}
            className={preset === p ? "bg-rose-600 hover:bg-rose-700" : ""}
            onClick={() => setPreset(p)}
          >
            {presetLabel[p]}
          </Button>
        ))}
        <Button
          variant={preset === "custom" ? "default" : "outline"}
          className={preset === "custom" ? "bg-rose-600 hover:bg-rose-700" : ""}
          onClick={() => setPreset("custom")}
        >
          Custom
        </Button>

        {preset === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              onClick={load}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Apply
            </Button>
          </div>
        )}
      </div>

      {/* Totals cards */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Total Sales" value={peso(totals.salesTotal)} />
          <SummaryCard
            label="Total Expenses"
            value={peso(totals.expenseTotal)}
          />
          <SummaryCard
            label="Net"
            value={peso(totals.net)}
            highlight={totals.net >= 0 ? "good" : "bad"}
          />
          <SummaryCard label="Sales Count" value={String(totals.salesCount)} />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500">
          No outlets found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-3 font-semibold">Outlet</th>
                <th className="p-3 text-right font-semibold">Sales</th>
                <th className="p-3 text-right font-semibold">Count</th>
                <th className="p-3 text-right font-semibold">Expenses</th>
                <th className="p-3 text-right font-semibold">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.outletId} className="border-t border-slate-100">
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">
                      {r.name}
                    </div>
                    {r.code ? (
                      <div className="text-xs text-slate-400">{r.code}</div>
                    ) : null}
                  </td>
                  <td className="p-3 text-right font-medium">
                    {peso(r.salesTotal)}
                  </td>
                  <td className="p-3 text-right text-slate-500">
                    {r.salesCount}
                  </td>
                  <td className="p-3 text-right text-slate-600">
                    {peso(r.expenseTotal)}
                  </td>
                  <td
                    className={`p-3 text-right font-bold ${
                      r.net >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {peso(r.net)}
                  </td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <tr>
                  <td className="p-3">All Outlets</td>
                  <td className="p-3 text-right">{peso(totals.salesTotal)}</td>
                  <td className="p-3 text-right text-slate-500">
                    {totals.salesCount}
                  </td>
                  <td className="p-3 text-right">
                    {peso(totals.expenseTotal)}
                  </td>
                  <td
                    className={`p-3 text-right ${
                      totals.net >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {peso(totals.net)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Note: only sales and expenses recorded on the cashier app are tied to a
        specific outlet. Sales created in the web app are not outlet-scoped and
        don&apos;t appear here.
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "good" | "bad";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-black ${
          highlight === "good"
            ? "text-emerald-600"
            : highlight === "bad"
              ? "text-rose-600"
              : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

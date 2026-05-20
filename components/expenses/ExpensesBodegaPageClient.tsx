"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleHeader } from "@/components/app-shell/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type ExpenseType =
  | "DELIVERY_EXPENSES"
  | "CLEANING_SUPPLIES"
  | "TRANSPORTATION_EXPENSES"
  | "MARINATE_EXPENSES"
  | "OFFICE_SUPPLIES"
  | "REPAIR_AND_MAINTENANCE"
  | "SALARIES"
  | "INCENTIVES_AND_ALLOWANCES"
  | "OTHERS";

type ExpenseRow = {
  _id: string;
  name: string;
  type: ExpenseType;
  expenseDate?: string;
  amount: number;
  remarks: string;
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const expenseTypeOptions: { label: string; value: ExpenseType }[] = [
  { label: "Delivery Expenses", value: "DELIVERY_EXPENSES" },
  { label: "Cleaning Supplies", value: "CLEANING_SUPPLIES" },
  { label: "Transportation Expenses", value: "TRANSPORTATION_EXPENSES" },
  { label: "Marinate Expenses", value: "MARINATE_EXPENSES" },
  { label: "Office Supplies", value: "OFFICE_SUPPLIES" },
  { label: "Repair & Maintenance", value: "REPAIR_AND_MAINTENANCE" },
  { label: "Salaries", value: "SALARIES" },
  { label: "Incitives & Allowances", value: "INCENTIVES_AND_ALLOWANCES" },
  { label: "Others", value: "OTHERS" },
];

const emptyForm = {
  name: "",
  type: "OTHERS" as ExpenseType,
  expenseDate: new Date().toISOString().slice(0, 10),
  amount: "0",
  remarks: "",
};

function getTypeLabel(type: string) {
  return expenseTypeOptions.find((item) => item.value === type)?.label || type;
}

export function ExpensesBodegaPageClient() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  const [summary, setSummary] = useState({
    rows: 0,
    totalAmount: 0,
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState("25");

  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    type: "ALL",
    dateFrom: "",
    dateTo: "",
  });

  const [form, setForm] = useState(emptyForm);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadExpenses() {
    setIsLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      limit,
    });

    if (appliedFilters.search) params.set("search", appliedFilters.search);
    if (appliedFilters.type !== "ALL") params.set("type", appliedFilters.type);
    if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
    if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);

    try {
      const res = await fetch(`/api/expenses?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load expenses.");
      }

      setRows(json.data || []);
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
        error instanceof Error ? error.message : "Failed to load expenses."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, appliedFilters]);

  function updateForm(name: keyof typeof emptyForm, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openAddDialog() {
    setEditingExpense(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(expense: ExpenseRow) {
    setEditingExpense(expense);
    setForm({
      name: expense.name,
      type: expense.type,
      expenseDate: expense.expenseDate
        ? new Date(expense.expenseDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      amount: String(expense.amount),
      remarks: expense.remarks || "",
    });
    setDialogOpen(true);
  }

  function applyFilters() {
    setAppliedFilters({
      search: search.trim(),
      type,
      dateFrom,
      dateTo,
    });
    setPage(1);
  }

  function resetFilters() {
    setSearch("");
    setType("ALL");
    setDateFrom("");
    setDateTo("");
    setAppliedFilters({
      search: "",
      type: "ALL",
      dateFrom: "",
      dateTo: "",
    });
    setPage(1);
  }

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error("Expense name is required.");
      return;
    }

    if ((Number(form.amount) || 0) <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    setIsSaving(true);

    try {
      const url = editingExpense
        ? `/api/expenses/${editingExpense._id}`
        : "/api/expenses";

      const res = await fetch(url, {
        method: editingExpense ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save expense.");
      }

      toast.success(json.message || "Expense saved successfully.");
      setDialogOpen(false);
      await loadExpenses();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save expense."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteExpense(expense: ExpenseRow) {
    const confirmed = window.confirm(`Delete expense "${expense.name}"?`);

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/expenses/${expense._id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete expense.");
      }

      toast.success(json.message || "Expense deleted successfully.");
      await loadExpenses();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete expense."
      );
    }
  }

  function formatDate(value?: string) {
    if (!value) return "—";
    return new Date(value).toISOString().slice(0, 10);
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Expenses (Bodega)"
        description="Track business operating expenses by expense type."
        actions={
          <Button onClick={openAddDialog} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        }
      />

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto_auto]">
          <div className="space-y-2">
            <Label>Search Name</Label>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. Ice, Diesel"
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Expense Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {expenseTypeOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button onClick={applyFilters} className="w-full rounded-xl">
              <Search className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </div>

          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={resetFilters}
              className="w-full rounded-xl"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Filtered Expenses</p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {summary.rows.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Total Expense Amount</p>
            <p className="mt-1 text-2xl font-black text-rose-600">
              {formatPeso(summary.totalAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-slate-950">
                Expense Records
              </p>
              <p className="text-sm text-slate-500">
                Showing {rows.length} of {meta.total} records
              </p>
            </div>

            <Select
              value={limit}
              onValueChange={(value) => {
                setLimit(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-950">
                <TableRow>
                  <TableHead className="text-white">#</TableHead>
                  <TableHead className="text-white">Name</TableHead>
                  <TableHead className="text-white">Type</TableHead>
                  <TableHead className="text-white">Date</TableHead>
                  <TableHead className="text-right text-white">
                    Amount
                  </TableHead>
                  <TableHead className="text-center text-white">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No expenses found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((expense, index) => (
                    <TableRow key={expense._id}>
                      <TableCell>
                        {(meta.page - 1) * meta.limit + index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {expense.name}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                          {getTypeLabel(expense.type)}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatPeso(expense.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(expense)}
                          >
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteExpense(expense)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              Previous
            </Button>

            <span className="rounded-xl border px-3 py-2 text-sm text-slate-600">
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">
              {editingExpense ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={saveExpense} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="e.g. Spoilage C10"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Expense Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) => updateForm("type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select expense type" />
                </SelectTrigger>
                <SelectContent>
                  {expenseTypeOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.expenseDate}
                onChange={(event) =>
                  updateForm("expenseDate", event.target.value)
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateForm("amount", event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input
                value={form.remarks}
                onChange={(event) => updateForm("remarks", event.target.value)}
                placeholder="Optional remarks"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
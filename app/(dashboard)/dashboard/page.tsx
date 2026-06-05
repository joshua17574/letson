// app/(dashboard)/dashboard/page.tsx
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  PackagePlus,
  ReceiptText,
  Scissors,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary } from "@/lib/dashboard";
import { cn, formatPeso } from "@/lib/utils";

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safePercent(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.min((value / total) * 100, 100);
}

function formatPercent(value: number) {
  return `${numberValue(value).toFixed(1)}%`;
}

function formatCompact(value: number) {
  return numberValue(value).toLocaleString("en-PH", {
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getChangeText(today: number, yesterday: number) {
  if (!yesterday && !today) return "No activity yet";
  if (!yesterday && today) return "New activity today";

  const diff = today - yesterday;
  const percent = (diff / yesterday) * 100;
  const sign = percent >= 0 ? "+" : "";

  return `${sign}${formatPercent(percent)} vs yesterday`;
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
  href,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  tone: "blue" | "emerald" | "rose" | "amber" | "slate" | "cyan";
  href?: string;
}) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  };

  const body = (
    <Card className="h-full rounded-2xl border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          </div>
          <div className={cn("rounded-2xl p-3 ring-1", toneMap[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return body;

  return <Link href={href}>{body}</Link>;
}

function ProgressLine({
  label,
  value,
  percent,
  barClassName,
}: {
  label: string;
  value: string;
  percent: number;
  barClassName: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-bold text-slate-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full", barClassName)}
          style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }}
        />
      </div>
    </div>
  );
}

function QuickAction({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: any;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-slate-950 p-3 text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-slate-950">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
    </Link>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "warning" | "danger" | "neutral";
}) {
  const toneMap = {
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warning: "bg-amber-50 text-amber-700 ring-amber-200",
    danger: "bg-rose-50 text-rose-700 ring-rose-200",
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1",
        toneMap[tone]
      )}
    >
      {label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  const collectionRate = safePercent(summary.totalPayments, summary.totalSales);
  const receivableRate = safePercent(
    summary.outstandingReceivables,
    summary.totalSales
  );
  const expenseRate = safePercent(summary.today.expenses, summary.today.payments);
  const monthExpenseRate = safePercent(
    summary.thisMonth.expenses,
    summary.thisMonth.payments
  );
  const stockHealthTone =
    summary.bodegaStock.outOfStockCount > 0
      ? "danger"
      : summary.bodegaStock.lowStockCount > 0
        ? "warning"
        : "good";
  const ownerStatusTone =
    summary.outstandingReceivables > 0 || summary.bodegaStock.lowStockCount > 0
      ? "warning"
      : "good";

  const currentDate = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const financialMax = Math.max(
    summary.thisMonth.sales,
    summary.thisMonth.payments,
    summary.thisMonth.expenses,
    summary.thisMonth.stockInPurchases,
    1
  );

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm">
        <div className="relative p-6 text-white md:p-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {currentDate}
                </span>
                <StatusPill
                  label={ownerStatusTone === "good" ? "Business stable" : "Needs owner attention"}
                  tone={ownerStatusTone}
                />
              </div>

              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Owner Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
                One-glance view of sales, collections, expenses, stock position,
                receivables, and slicing activity.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
              <Link
                href="/sales"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
              >
                New Sale
              </Link>
              <Link
                href="/expenses-bodega"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/15"
              >
                Add Expense
              </Link>
              <Link
                href="/inventory/bodega"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/15"
              >
                View Inventory
              </Link>
              <Link
                href="/payments/add"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/15"
              >
                Record Payment
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Today Sales"
          value={formatPeso(summary.today.sales)}
          subtitle={getChangeText(summary.today.sales, summary.yesterday.sales)}
          icon={ShoppingCart}
          tone="blue"
          href="/sales/history"
        />
        <KpiCard
          title="Today Collections"
          value={formatPeso(summary.today.payments)}
          subtitle={getChangeText(summary.today.payments, summary.yesterday.payments)}
          icon={WalletCards}
          tone="emerald"
          href="/payments/history"
        />
        <KpiCard
          title="Today Expenses"
          value={formatPeso(summary.today.expenses)}
          subtitle={getChangeText(summary.today.expenses, summary.yesterday.expenses)}
          icon={ReceiptText}
          tone="rose"
          href="/expenses-bodega"
        />
        <KpiCard
          title="Bodega Inventory Value"
          value={formatPeso(summary.bodegaStock.totalCostValue)}
          subtitle={`${formatCompact(summary.bodegaStock.totalProducts)} active products tracked`}
          icon={Boxes}
          tone="amber"
          href="/bodega-products"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-black">Business Pulse</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Month-to-date sales, collections, expenses, and inventory received.
                </p>
              </div>
              <StatusPill
                label={`${formatPercent(collectionRate)} collected`}
                tone={collectionRate >= 80 ? "good" : collectionRate >= 50 ? "warning" : "danger"}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <ProgressLine
              label="Sales"
              value={formatPeso(summary.thisMonth.sales)}
              percent={safePercent(summary.thisMonth.sales, financialMax)}
              barClassName="bg-blue-600"
            />
            <ProgressLine
              label="Collections"
              value={formatPeso(summary.thisMonth.payments)}
              percent={safePercent(summary.thisMonth.payments, financialMax)}
              barClassName="bg-emerald-600"
            />
            <ProgressLine
              label="Expenses"
              value={formatPeso(summary.thisMonth.expenses)}
              percent={safePercent(summary.thisMonth.expenses, financialMax)}
              barClassName="bg-rose-600"
            />
            <ProgressLine
              label="Stock In / Purchases"
              value={formatPeso(summary.thisMonth.stockInPurchases)}
              percent={safePercent(summary.thisMonth.stockInPurchases, financialMax)}
              barClassName="bg-amber-500"
            />

            <div className="grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-3">
              <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <TrendingUp className="h-4 w-4" />
                  Operating Cash
                </div>
                <p className="mt-2 text-xl font-black text-emerald-950">
                  {formatPeso(summary.thisMonth.operatingCash)}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  Collections minus expenses only.
                </p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-100">
                <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
                  <TrendingDown className="h-4 w-4" />
                  Receivables
                </div>
                <p className="mt-2 text-xl font-black text-rose-950">
                  {formatPeso(summary.outstandingReceivables)}
                </p>
                <p className="mt-1 text-xs text-rose-700">
                  {formatPercent(receivableRate)} of total sales unpaid.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <DollarSign className="h-4 w-4" />
                  Expense Load
                </div>
                <p className="mt-2 text-xl font-black text-slate-950">
                  {formatPercent(monthExpenseRate)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Expenses against collections this month.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-black">Today at a Glance</CardTitle>
            <p className="text-sm text-slate-500">
              Daily movement for owner monitoring.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Slicing Production
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-black text-slate-950">
                    {formatCompact(summary.today.slicingPacks)} packs
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCompact(summary.today.slicingHeads)} heads processed
                  </p>
                </div>
                <Scissors className="h-8 w-8 text-slate-300" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Expenses Paid Today
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-black text-slate-950">
                    {formatPeso(summary.today.expenses)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatPercent(expenseRate)} of collections
                  </p>
                </div>
                <ReceiptText className="h-8 w-8 text-slate-300" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Stock In Today
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-black text-slate-950">
                    {formatPeso(summary.today.stockInPurchases)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Purchases and supplier deliveries
                  </p>
                </div>
                <PackagePlus className="h-8 w-8 text-slate-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-black">Inventory Stock Watch</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Pack-aware stock display for sliced chicken products.
                </p>
              </div>
              <StatusPill
                label={
                  stockHealthTone === "good"
                    ? "Healthy"
                    : stockHealthTone === "warning"
                      ? "Low stock"
                      : "Out of stock"
                }
                tone={stockHealthTone}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Inventory Cost Value
                </p>
                <p className="mt-2 text-xl font-black text-slate-950">
                  {formatPeso(summary.bodegaStock.totalCostValue)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Based on buying price x stock qty.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Stock Alerts
                </p>
                <p className="mt-2 text-xl font-black text-slate-950">
                  {formatCompact(summary.bodegaStock.lowStockCount + summary.bodegaStock.outOfStockCount)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Low and out-of-stock products.
                </p>
              </div>
            </div>

            {summary.bodegaStock.lowStockProducts.length ? (
              <div className="space-y-3">
                {summary.bodegaStock.lowStockProducts.map((product) => (
                  <div
                    key={product._id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"
                  >
                    <div>
                      <p className="font-bold text-slate-950">{product.name}</p>
                      <p className="text-xs text-slate-500">
                        {product.display} - {product.detail}
                      </p>
                    </div>
                    <StatusPill
                      label={product.isOutOfStock ? "Out" : "Low"}
                      tone={product.isOutOfStock ? "danger" : "warning"}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No low-stock bodega products detected." />
            )}

            <Link
              href="/bodega-products"
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-950 hover:underline"
            >
              Open Bodega Products <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-black">Top Inventory Value</CardTitle>
            <p className="text-sm text-slate-500">
              Highest stock value products, including pack breakdown when available.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left">Product</th>
                    <th className="px-5 py-3 text-left">Stock Display</th>
                    <th className="px-5 py-3 text-right">Cost Value</th>
                    <th className="px-5 py-3 text-right">Selling Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.bodegaStock.topInventoryProducts.length ? (
                    summary.bodegaStock.topInventoryProducts.map((product) => (
                      <tr key={product._id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4 font-bold text-slate-950">
                          {product.name}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          <div>{product.display}</div>
                          <div className="text-xs text-slate-400">{product.detail}</div>
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900">
                          {formatPeso(product.inventoryCostValue)}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900">
                          {formatPeso(product.inventorySellingValue)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                        No inventory products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-black">Recent Money Movement</CardTitle>
            <p className="text-sm text-slate-500">
              Latest sales, collections, and expenses.
            </p>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 lg:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-950">
                <ShoppingCart className="h-4 w-4 text-blue-600" /> Sales
              </div>
              {summary.recent.sales.length ? (
                summary.recent.sales.map((sale) => (
                  <div key={sale._id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="font-bold text-slate-950">{sale.title}</p>
                    <p className="text-xs text-slate-500">{sale.name}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{formatPeso(sale.amount)}</span>
                      <StatusPill
                        label={sale.status || "Sale"}
                        tone={sale.balance > 0 ? "warning" : "good"}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No recent sales." />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-950">
                <CreditCard className="h-4 w-4 text-emerald-600" /> Payments
              </div>
              {summary.recent.payments.length ? (
                summary.recent.payments.map((payment) => (
                  <div key={payment._id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="font-bold text-slate-950">{payment.title}</p>
                    <p className="text-xs text-slate-500">{payment.name}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{formatPeso(payment.amount)}</span>
                      <span className="text-xs text-slate-500">{formatDate(payment.date)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No recent payments." />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-950">
                <ReceiptText className="h-4 w-4 text-rose-600" /> Expenses
              </div>
              {summary.recent.expenses.length ? (
                summary.recent.expenses.map((expense) => (
                  <div key={expense._id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="font-bold text-slate-950">{expense.title}</p>
                    <p className="text-xs text-slate-500">{expense.type}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{formatPeso(expense.amount)}</span>
                      <span className="text-xs text-slate-500">{formatDate(expense.date)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No recent expenses." />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-black">Operations Monitor</CardTitle>
            <p className="text-sm text-slate-500">
              Customer base, suppliers, slicing activity, and owner reminders.
            </p>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100">
                <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
                  <Users className="h-4 w-4" /> Customers
                </div>
                <p className="mt-2 text-2xl font-black text-blue-950">
                  {formatCompact(summary.totalCustomers)}
                </p>
              </div>
              <div className="rounded-2xl bg-cyan-50 p-4 ring-1 ring-cyan-100">
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-700">
                  <Boxes className="h-4 w-4" /> Suppliers
                </div>
                <p className="mt-2 text-2xl font-black text-cyan-950">
                  {formatCompact(summary.totalSuppliers)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-slate-950">Recent Slicing</p>
                <Link href="/slicing" className="text-xs font-bold text-slate-600 hover:underline">
                  View history
                </Link>
              </div>
              {summary.recent.slicing.length ? (
                summary.recent.slicing.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"
                  >
                    <div>
                      <p className="font-bold text-slate-950">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        {formatCompact(item.totalActualPcs)} pcs - {formatCompact(item.totalPacks)} packs
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {formatDate(item.date)}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No recent slicing records." />
              )}
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="flex gap-3">
                {summary.outstandingReceivables > 0 || summary.bodegaStock.lowStockCount > 0 ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-black">Owner Notes</p>
                  <p className="mt-1 text-sm">
                    {summary.outstandingReceivables > 0
                      ? `Follow up ${formatPeso(summary.outstandingReceivables)} receivables and monitor collections.`
                      : "Receivables are clear based on recorded sales and payments."}
                    {summary.bodegaStock.lowStockCount > 0
                      ? ` ${summary.bodegaStock.lowStockCount} products are low stock.`
                      : " Inventory alerts look good."}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-xl font-black">Quick Operations</CardTitle>
          <p className="text-sm text-slate-500">
            Common owner and cashier actions in one place.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            title="Sell Chicken"
            description="Create pack-aware chicken sale"
            href="/sales"
            icon={ShoppingCart}
          />
          <QuickAction
            title="Add Expense"
            description="Record bodega expense"
            href="/expenses-bodega"
            icon={ReceiptText}
          />
          <QuickAction
            title="Slicing History"
            description="Review daily slicing activity"
            href="/slicing"
            icon={Scissors}
          />
          <QuickAction
            title="Profit Reports"
            description="Review sales and slicing reports"
            href="/reports/chicken-slicing"
            icon={BarChart3}
          />
        </CardContent>
      </Card>
    </div>
  );
}

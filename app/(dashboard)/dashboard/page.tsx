// app/(dashboard)/dashboard/page.tsx
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  PackagePlus,
  PhilippinePeso,
  ReceiptText,
  Scissors,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AnimatedValue } from "@/components/motion/AnimatedValue";
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
  icon: LucideIcon;
  tone: "blue" | "emerald" | "rose" | "amber" | "slate" | "cyan";
  href?: string;
}) {
  const toneMap = {
    blue: "tone-brand",
    emerald: "tone-success",
    rose: "tone-danger",
    amber: "tone-orange",
    slate: "tone-neutral",
    cyan: "tone-orange",
  };

  const body = (
    <Card className="surface-panel h-full rounded-2xl transition hover:-translate-y-0.5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="tabular-value mt-2 text-2xl font-black tracking-tight text-foreground">
              <AnimatedValue value={value} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={cn("rounded-2xl p-3", toneMap[tone])}>
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
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="tabular-value font-bold text-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("motion-shimmer h-full rounded-full", barClassName)}
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
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="surface-panel group flex items-center justify-between gap-3 rounded-2xl p-4 transition hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary p-3 text-primary-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
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
    good: "tone-success",
    warning: "tone-orange",
    danger: "tone-danger",
    neutral: "tone-neutral",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
        toneMap[tone]
      )}
    >
      {label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/25 p-6 text-center text-sm text-muted-foreground">
      <span>{message}</span>
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
      <div className="dashboard-hero overflow-hidden rounded-3xl border">
        <div className="relative p-6 text-primary-foreground md:p-8">
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="dashboard-hero-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
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
              <p className="mt-2 max-w-2xl text-sm text-primary-foreground/72 md:text-base">
                One-glance view of sales, collections, expenses, stock position,
                receivables, and slicing activity.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
              <Link
                href="/sales"
                className="dashboard-hero-action-primary rounded-2xl px-4 py-3 text-sm font-bold transition hover:-translate-y-0.5"
              >
                New Sale
              </Link>
              <Link
                href="/expenses-bodega"
                className="dashboard-hero-action-secondary rounded-2xl px-4 py-3 text-sm font-bold transition hover:-translate-y-0.5"
              >
                Add Expense
              </Link>
              <Link
                href="/inventory/bodega"
                className="dashboard-hero-action-secondary rounded-2xl px-4 py-3 text-sm font-bold transition hover:-translate-y-0.5"
              >
                View Inventory
              </Link>
              <Link
                href="/payments/add"
                className="dashboard-hero-action-secondary rounded-2xl px-4 py-3 text-sm font-bold transition hover:-translate-y-0.5"
              >
                Record Payment
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="motion-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <Card className="surface-panel rounded-2xl">
          <CardHeader className="border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-black">Business Pulse</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
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
              barClassName="bg-green-500"
            />
            <ProgressLine
              label="Expenses"
              value={formatPeso(summary.thisMonth.expenses)}
              percent={safePercent(summary.thisMonth.expenses, financialMax)}
              barClassName="bg-destructive"
            />
            <ProgressLine
              label="Stock In / Purchases"
              value={formatPeso(summary.thisMonth.stockInPurchases)}
              percent={safePercent(summary.thisMonth.stockInPurchases, financialMax)}
              barClassName="bg-ring"
            />

            <div className="grid gap-3 border-t border-border pt-5 md:grid-cols-3">
              <div className="rounded-2xl bg-muted/45 p-4 ring-1 ring-border">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Operating Cash
                </div>
                <p className="tabular-value mt-2 text-xl font-black text-foreground">
                  {formatPeso(summary.thisMonth.operatingCash)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Collections minus expenses only.
                </p>
              </div>
              <div className="rounded-2xl bg-destructive/10 p-4 ring-1 ring-destructive/20">
                <div className="flex items-center gap-2 text-sm font-bold text-destructive">
                  <TrendingDown className="h-4 w-4" />
                  Receivables
                </div>
                <p className="tabular-value mt-2 text-xl font-black text-foreground">
                  {formatPeso(summary.outstandingReceivables)}
                </p>
                <p className="mt-1 text-xs text-destructive">
                  {formatPercent(receivableRate)} of total sales unpaid.
                </p>
              </div>
              <div className="rounded-2xl bg-muted/45 p-4 ring-1 ring-border">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <PhilippinePeso className="h-4 w-4" />
                  Expense Load
                </div>
                <p className="tabular-value mt-2 text-xl font-black text-foreground">
                  {formatPercent(monthExpenseRate)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Expenses against collections this month.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-panel rounded-2xl">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-xl font-black">Today at a Glance</CardTitle>
            <p className="text-sm text-muted-foreground">
              Daily movement for owner monitoring.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Slicing Production
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="tabular-value text-2xl font-black text-foreground">
                    {formatCompact(summary.today.slicingPacks)} packs
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCompact(summary.today.slicingHeads)} heads processed
                  </p>
                </div>
                    <Scissors className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Expenses Paid Today
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="tabular-value text-2xl font-black text-foreground">
                    {formatPeso(summary.today.expenses)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPercent(expenseRate)} of collections
                  </p>
                </div>
                <ReceiptText className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Stock In Today
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="tabular-value text-2xl font-black text-foreground">
                    {formatPeso(summary.today.stockInPurchases)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Purchases and supplier deliveries
                  </p>
                </div>
                <PackagePlus className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="surface-panel rounded-2xl">
          <CardHeader className="border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-black">Inventory Stock Watch</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
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
              <div className="rounded-2xl bg-muted/45 p-4 ring-1 ring-border">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Inventory Cost Value
                </p>
                <p className="tabular-value mt-2 text-xl font-black text-foreground">
                  {formatPeso(summary.bodegaStock.totalCostValue)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Based on buying price x stock qty.
                </p>
              </div>
              <div className="rounded-2xl bg-muted/45 p-4 ring-1 ring-border">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Stock Alerts
                </p>
                <p className="tabular-value mt-2 text-xl font-black text-foreground">
                  {formatCompact(summary.bodegaStock.lowStockCount + summary.bodegaStock.outOfStockCount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Low and out-of-stock products.
                </p>
              </div>
            </div>

            {summary.bodegaStock.lowStockProducts.length ? (
              <div className="space-y-3">
                {summary.bodegaStock.lowStockProducts.map((product) => (
                  <div
                    key={product._id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/45 p-3 transition hover:bg-muted/35"
                  >
                    <div>
                      <p className="font-bold text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
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
              className="inline-flex items-center gap-2 text-sm font-bold text-foreground hover:underline"
            >
              Open Bodega Products <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="surface-panel rounded-2xl">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-xl font-black">Top Inventory Value</CardTitle>
            <p className="text-sm text-muted-foreground">
              Highest stock value products, including pack breakdown when available.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left">Product</th>
                    <th className="px-5 py-3 text-left">Stock Display</th>
                    <th className="px-5 py-3 text-right">Cost Value</th>
                    <th className="px-5 py-3 text-right">Selling Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.bodegaStock.topInventoryProducts.length ? (
                    summary.bodegaStock.topInventoryProducts.map((product) => (
                      <tr key={product._id} className="transition hover:bg-muted/35">
                        <td className="px-5 py-4 font-bold text-foreground">
                          {product.name}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          <div>{product.display}</div>
                          <div className="text-xs text-muted-foreground/70">{product.detail}</div>
                        </td>
                        <td className="tabular-value px-5 py-4 text-right font-semibold text-foreground">
                          {formatPeso(product.inventoryCostValue)}
                        </td>
                        <td className="tabular-value px-5 py-4 text-right font-semibold text-foreground">
                          {formatPeso(product.inventorySellingValue)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
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
        <Card className="surface-panel rounded-2xl">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-xl font-black">Recent Money Movement</CardTitle>
            <p className="text-sm text-muted-foreground">
              Latest sales, collections, and expenses.
            </p>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 lg:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" /> Sales
              </div>
              {summary.recent.sales.length ? (
                summary.recent.sales.map((sale) => (
                  <div key={sale._id} className="rounded-2xl bg-muted/35 p-3 ring-1 ring-border">
                    <p className="font-bold text-foreground">{sale.title}</p>
                    <p className="text-xs text-muted-foreground">{sale.name}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="tabular-value text-sm font-bold">{formatPeso(sale.amount)}</span>
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
              <div className="flex items-center gap-2 font-bold text-foreground">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> Payments
              </div>
              {summary.recent.payments.length ? (
                summary.recent.payments.map((payment) => (
                  <div key={payment._id} className="rounded-2xl bg-muted/35 p-3 ring-1 ring-border">
                    <p className="font-bold text-foreground">{payment.title}</p>
                    <p className="text-xs text-muted-foreground">{payment.name}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="tabular-value text-sm font-bold">{formatPeso(payment.amount)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(payment.date)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No recent payments." />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <ReceiptText className="h-4 w-4 text-muted-foreground" /> Expenses
              </div>
              {summary.recent.expenses.length ? (
                summary.recent.expenses.map((expense) => (
                  <div key={expense._id} className="rounded-2xl bg-muted/35 p-3 ring-1 ring-border">
                    <p className="font-bold text-foreground">{expense.title}</p>
                    <p className="text-xs text-muted-foreground">{expense.type}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="tabular-value text-sm font-bold">{formatPeso(expense.amount)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(expense.date)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No recent expenses." />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="surface-panel rounded-2xl">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-xl font-black">Operations Monitor</CardTitle>
            <p className="text-sm text-muted-foreground">
              Customer base, suppliers, slicing activity, and owner reminders.
            </p>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-muted/45 p-4 ring-1 ring-border">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Users className="h-4 w-4" /> Customers
                </div>
                <p className="tabular-value mt-2 text-2xl font-black text-foreground">
                  {formatCompact(summary.totalCustomers)}
                </p>
              </div>
              <div className="rounded-2xl bg-muted/45 p-4 ring-1 ring-border">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Boxes className="h-4 w-4" /> Suppliers
                </div>
                <p className="tabular-value mt-2 text-2xl font-black text-foreground">
                  {formatCompact(summary.totalSuppliers)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-foreground">Recent Slicing</p>
                <Link href="/slicing" className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline">
                  View history
                </Link>
              </div>
              {summary.recent.slicing.length ? (
                summary.recent.slicing.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/45 p-3 transition hover:bg-muted/35"
                  >
                    <div>
                      <p className="font-bold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCompact(item.totalActualPcs)} pcs - {formatCompact(item.totalPacks)} packs
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {formatDate(item.date)}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No recent slicing records." />
              )}
            </div>

            <div className="rounded-2xl border border-border bg-muted/45 p-4 text-foreground">
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

      <Card className="surface-panel rounded-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-xl font-black">Quick Operations</CardTitle>
          <p className="text-sm text-muted-foreground">
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

// app/(dashboard)/dashboard/page.tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  PackageCheck,
  PackagePlus,
  ReceiptText,
  Scissors,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary, type DashboardActivityItem } from "@/lib/dashboard";
import { cn, formatPeso } from "@/lib/utils";

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown, options?: Intl.NumberFormatOptions) {
  return numberValue(value).toLocaleString("en-PH", {
    maximumFractionDigits: 0,
    ...options,
  });
}

function formatPercent(value: number) {
  return `${numberValue(value).toFixed(1)}%`;
}

function safePercent(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.min((value / total) * 100, 100);
}

function getChangePercent(today: number, yesterday: number) {
  if (!yesterday && !today) return 0;
  if (!yesterday && today) return 100;
  return ((today - yesterday) / yesterday) * 100;
}

function getChangeLabel(today: number, yesterday: number) {
  if (!yesterday && !today) return "No activity yesterday";
  if (!yesterday && today) return "New activity today";

  const change = getChangePercent(today, yesterday);
  const sign = change >= 0 ? "+" : "";
  return `${sign}${formatPercent(change)} vs yesterday`;
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

function currentDateLabel() {
  return new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type Tone = "blue" | "emerald" | "rose" | "amber" | "slate" | "purple";

const toneClasses: Record<Tone, string> = {
  blue: "border-blue-100 bg-blue-50/70 text-blue-700",
  emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-700",
  rose: "border-rose-100 bg-rose-50/70 text-rose-700",
  amber: "border-amber-100 bg-amber-50/70 text-amber-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  purple: "border-violet-100 bg-violet-50/70 text-violet-700",
};

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
  change,
  href,
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: Tone;
  change?: {
    label: string;
    positive?: boolean;
  };
  href?: string;
}) {
  const body = (
    <Card className="group overflow-hidden rounded-3xl border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              {title}
            </p>
            <p className="mt-3 truncate text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {value}
            </p>
            <p className="mt-1 text-sm text-slate-500">{helper}</p>
          </div>
          <div className={cn("rounded-2xl border p-3", toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {change ? (
          <div
            className={cn(
              "mt-5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
              change.positive === false
                ? "bg-rose-50 text-rose-700"
                : "bg-emerald-50 text-emerald-700"
            )}
          >
            {change.positive === false ? (
              <TrendingDown className="h-3.5 w-3.5" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5" />
            )}
            {change.label}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}

function ProgressLine({
  label,
  value,
  percent,
  tone,
}: {
  label: string;
  value: string;
  percent: number;
  tone: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-black text-slate-950">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-slate-950 p-2.5 text-white shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function ActivityList({
  items,
  emptyMessage,
}: {
  items: DashboardActivityItem[];
  emptyMessage: string;
}) {
  if (!items.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">
              {item.title}
            </p>
            <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
          </div>
          <div className="shrink-0 text-right">
            {typeof item.amount === "number" ? (
              <p className="text-sm font-black text-slate-950">
                {formatPeso(item.amount)}
              </p>
            ) : null}
            <p className="text-xs text-slate-500">{formatDate(item.date)}</p>
          </div>
        </div>
      ))}
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
      className="group flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
    >
      <div className="rounded-2xl bg-slate-950 p-3 text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-slate-950">{title}</p>
        <p className="truncate text-sm text-slate-500">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
    </Link>
  );
}

function StockStatusBadge({ status }: { status: "good" | "low" | "out" }) {
  if (status === "out") {
    return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Out</Badge>;
  }

  if (status === "low") {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Low</Badge>;
  }

  return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Good</Badge>;
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  const collectionRate = safePercent(summary.thisMonth.payments, summary.thisMonth.sales);
  const receivableRate = safePercent(summary.outstandingReceivables, summary.totalSales);
  const expenseLoad = safePercent(summary.thisMonth.expenses, summary.thisMonth.payments);
  const todayCashPositive = summary.today.operatingCash >= 0;
  const todaySalesChange = getChangePercent(summary.today.sales, summary.yesterday.sales);
  const todayPaymentChange = getChangePercent(summary.today.payments, summary.yesterday.payments);
  const todayExpenseChange = getChangePercent(summary.today.expenses, summary.yesterday.expenses);
  const monthMax = Math.max(
    summary.thisMonth.sales,
    summary.thisMonth.payments,
    summary.thisMonth.expenses,
    summary.thisMonth.stockInPurchases,
    1
  );

  const stockAlertCount = summary.bodegaStock.lowStockCount + summary.bodegaStock.outOfStockCount;
  const generatedAt = new Date(summary.generatedAt).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute bottom-0 right-36 h-44 w-44 rounded-full bg-blue-400/20 blur-3xl" />

          <div className="relative grid gap-8 xl:grid-cols-[1.3fr_0.7fr] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/10">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  {currentDateLabel()}
                </Badge>
                <Badge className="rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/10">
                  <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                  Updated {generatedAt}
                </Badge>
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                Owner Command Center
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-300 sm:text-lg">
                A desktop-style one-glance dashboard for sales, collections,
                expenses, stock health, receivables, and slicing production.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="rounded-2xl bg-white text-slate-950 hover:bg-slate-100">
                  <Link href="/sales/new/chicken">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    New Chicken Sale
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="rounded-2xl bg-white/10 text-white hover:bg-white/20">
                  <Link href="/expenses-bodega">
                    <ReceiptText className="mr-2 h-4 w-4" />
                    Add Expense
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="rounded-2xl bg-white/10 text-white hover:bg-white/20">
                  <Link href="/inventory/bodega">
                    <Boxes className="mr-2 h-4 w-4" />
                    View Stock
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-300">
                    Today Net Cash
                  </p>
                  <p className="mt-1 text-3xl font-black">
                    {formatPeso(summary.today.operatingCash)}
                  </p>
                  <p className="text-sm text-slate-300">
                    Collections minus expenses today
                  </p>
                </div>
                <div className={cn(
                  "rounded-2xl p-3",
                  todayCashPositive ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200"
                )}>
                  {todayCashPositive ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="font-black">{formatNumber(summary.today.salesCount)}</p>
                  <p className="text-xs text-slate-300">Sales</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="font-black">{formatNumber(summary.today.paymentCount)}</p>
                  <p className="text-xs text-slate-300">Payments</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="font-black">{formatNumber(summary.today.slicingCount)}</p>
                  <p className="text-xs text-slate-300">Slicing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Today Sales"
          value={formatPeso(summary.today.sales)}
          helper={`${formatNumber(summary.today.salesCount)} sales transactions`}
          icon={ShoppingCart}
          tone="blue"
          href="/sales"
          change={{
            label: getChangeLabel(summary.today.sales, summary.yesterday.sales),
            positive: todaySalesChange >= 0,
          }}
        />
        <MetricCard
          title="Today Collections"
          value={formatPeso(summary.today.payments)}
          helper={`${formatNumber(summary.today.paymentCount)} payment records`}
          icon={WalletCards}
          tone="emerald"
          href="/payments"
          change={{
            label: getChangeLabel(summary.today.payments, summary.yesterday.payments),
            positive: todayPaymentChange >= 0,
          }}
        />
        <MetricCard
          title="Today Expenses"
          value={formatPeso(summary.today.expenses)}
          helper={`${formatNumber(summary.today.expenseCount)} expense records`}
          icon={ReceiptText}
          tone="rose"
          href="/expenses-bodega"
          change={{
            label: getChangeLabel(summary.today.expenses, summary.yesterday.expenses),
            positive: todayExpenseChange <= 0,
          }}
        />
        <MetricCard
          title="Stock Alerts"
          value={formatNumber(stockAlertCount)}
          helper={`${formatNumber(summary.bodegaStock.outOfStockCount)} out, ${formatNumber(summary.bodegaStock.lowStockCount)} low`}
          icon={AlertTriangle}
          tone={stockAlertCount > 0 ? "amber" : "emerald"}
          href="/bodega-products"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[2rem] border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <SectionTitle
              icon={DollarSign}
              title="Month Performance"
              description="Sales, collections, expenses, and inventory purchases this month."
            />
          </CardHeader>
          <CardContent className="space-y-5 p-6 pt-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Collection Rate
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatPercent(collectionRate)}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Expense Load
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatPercent(expenseLoad)}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Receivables
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatPercent(receivableRate)}
                </p>
              </div>
            </div>

            <ProgressLine
              label="Sales"
              value={formatPeso(summary.thisMonth.sales)}
              percent={safePercent(summary.thisMonth.sales, monthMax)}
              tone="bg-blue-600"
            />
            <ProgressLine
              label="Collections"
              value={formatPeso(summary.thisMonth.payments)}
              percent={safePercent(summary.thisMonth.payments, monthMax)}
              tone="bg-emerald-600"
            />
            <ProgressLine
              label="Expenses"
              value={formatPeso(summary.thisMonth.expenses)}
              percent={safePercent(summary.thisMonth.expenses, monthMax)}
              tone="bg-rose-600"
            />
            <ProgressLine
              label="Stock In / Purchases"
              value={formatPeso(summary.thisMonth.stockInPurchases)}
              percent={safePercent(summary.thisMonth.stockInPurchases, monthMax)}
              tone="bg-amber-500"
            />
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <SectionTitle
              icon={PackageCheck}
              title="Inventory Command Center"
              description="Live stock position using professional pack and loose-pcs display."
              action={
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/bodega-products">Open Products</Link>
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="p-6 pt-2">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Cost Value
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatPeso(summary.bodegaStock.totalCostValue)}
                </p>
                <p className="text-xs text-slate-500">Buying value on hand</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Selling Value
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatPeso(summary.bodegaStock.totalSellingValue)}
                </p>
                <p className="text-xs text-slate-500">Estimated sellable value</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Product Types
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatNumber(summary.bodegaStock.slicedProductCount)} / {formatNumber(summary.bodegaStock.wholeChickenCount)}
                </p>
                <p className="text-xs text-slate-500">Sliced / whole chicken</p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="font-black text-slate-950">Top Inventory Value</p>
                <p className="text-xs text-slate-500">Highest stock value products.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {summary.bodegaStock.topInventoryProducts.length ? (
                  summary.bodegaStock.topInventoryProducts.map((product) => (
                    <div key={product.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-slate-950">{product.name}</p>
                          <StockStatusBadge status={product.status} />
                        </div>
                        <p className="text-sm text-slate-600">{product.display}</p>
                        <p className="text-xs text-slate-500">{product.detail}</p>
                      </div>
                      <div className="text-sm sm:text-right">
                        <p className="text-slate-500">Cost Value</p>
                        <p className="font-black text-slate-950">{formatPeso(product.inventoryCostValue)}</p>
                      </div>
                      <div className="text-sm sm:text-right">
                        <p className="text-slate-500">Sell Value</p>
                        <p className="font-black text-slate-950">{formatPeso(product.inventorySellingValue)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4">
                    <EmptyState message="No inventory products found." />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card className="rounded-[2rem] border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <SectionTitle
              icon={Sparkles}
              title="Today Operations"
              description="Production, stock-in purchases, and business activity for today."
            />
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-2 md:grid-cols-3">
            <div className="rounded-3xl border border-violet-100 bg-violet-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700">
                    Slicing
                  </p>
                  <p className="mt-2 text-3xl font-black text-violet-950">
                    {formatNumber(summary.today.slicingPacks)} packs
                  </p>
                </div>
                <Scissors className="h-6 w-6 text-violet-700" />
              </div>
              <p className="mt-2 text-sm text-violet-800">
                {formatNumber(summary.today.slicingHeads)} heads, {formatNumber(summary.today.slicingActualPcs)} pcs
              </p>
            </div>
            <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                    Stock In
                  </p>
                  <p className="mt-2 text-3xl font-black text-amber-950">
                    {formatPeso(summary.today.stockInPurchases)}
                  </p>
                </div>
                <PackagePlus className="h-6 w-6 text-amber-700" />
              </div>
              <p className="mt-2 text-sm text-amber-800">Deliveries and purchases today</p>
            </div>
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
                    Contacts
                  </p>
                  <p className="mt-2 text-3xl font-black text-blue-950">
                    {formatNumber(summary.totalCustomers)}
                  </p>
                </div>
                <Users className="h-6 w-6 text-blue-700" />
              </div>
              <p className="mt-2 text-sm text-blue-800">
                {formatNumber(summary.totalSuppliers)} suppliers active
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <SectionTitle
              icon={AlertTriangle}
              title="Owner Attention"
              description="Items that may need follow-up."
            />
          </CardHeader>
          <CardContent className="space-y-3 p-6 pt-2">
            {summary.outstandingReceivables > 0 ? (
              <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 text-amber-700" />
                  <div>
                    <p className="font-black text-amber-950">Receivables need follow-up</p>
                    <p className="text-sm text-amber-800">
                      Current unpaid customer balance is {formatPeso(summary.outstandingReceivables)}.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
                  <div>
                    <p className="font-black text-emerald-950">Receivables are clear</p>
                    <p className="text-sm text-emerald-800">No unpaid balance detected from recorded sales and payments.</p>
                  </div>
                </div>
              </div>
            )}

            {summary.bodegaStock.lowStockProducts.length ? (
              <div className="rounded-3xl border border-slate-200 p-4">
                <p className="mb-3 font-black text-slate-950">Low / Out Stock</p>
                <div className="space-y-2">
                  {summary.bodegaStock.lowStockProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950">{product.name}</p>
                        <p className="truncate text-xs text-slate-500">{product.display}</p>
                      </div>
                      <StockStatusBadge status={product.status} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
                  <div>
                    <p className="font-black text-emerald-950">Inventory alerts look good</p>
                    <p className="text-sm text-emerald-800">No low or out-of-stock bodega products detected.</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[2rem] border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <SectionTitle
              icon={ReceiptText}
              title="Expenses by Business"
              description="Bodega and grocery operating expenses, split by category."
              action={
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/expenses-bodega">Open Expenses</Link>
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="space-y-5 p-6 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                  Bodega Expenses
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatPeso(summary.thisMonth.bodegaExpenses)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Today {formatPeso(summary.today.bodegaExpenses)} · All-time{" "}
                  {formatPeso(summary.totalBodegaExpenses)}
                </p>
              </div>
              <div className="rounded-3xl border border-violet-100 bg-violet-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700">
                  Grocery Expenses
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatPeso(summary.thisMonth.groceryExpenses)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Today {formatPeso(summary.today.groceryExpenses)} · All-time{" "}
                  {formatPeso(summary.totalGroceryExpenses)}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                This Month Split
              </p>
              <ProgressLine
                label="Bodega"
                value={formatPeso(summary.thisMonth.bodegaExpenses)}
                percent={safePercent(
                  summary.thisMonth.bodegaExpenses,
                  summary.thisMonth.expenses
                )}
                tone="bg-amber-500"
              />
              <div className="mt-3" />
              <ProgressLine
                label="Grocery"
                value={formatPeso(summary.thisMonth.groceryExpenses)}
                percent={safePercent(
                  summary.thisMonth.groceryExpenses,
                  summary.thisMonth.expenses
                )}
                tone="bg-violet-500"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <SectionTitle
              icon={Store}
              title="Outlets"
              description="Outlet network and stock value held across outlets."
              action={
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/outlets">Open Outlets</Link>
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="space-y-5 p-6 pt-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Active Outlets
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatNumber(summary.outlets.activeOutlets)}
                  <span className="text-base font-bold text-slate-400">
                    {" "}
                    / {formatNumber(summary.outlets.totalOutlets)}
                  </span>
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Stock Value
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatPeso(summary.outlets.totalStockValue)}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Stocked Items
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatNumber(summary.outlets.totalItems)}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Top Outlets by Stock Value
              </p>
              <div className="overflow-hidden rounded-3xl border border-slate-100">
                {summary.outlets.topOutlets.length ? (
                  summary.outlets.topOutlets.map((outlet) => (
                    <div
                      key={outlet.id}
                      className="grid gap-3 border-b border-slate-100 p-4 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {outlet.name}
                        </p>
                        {outlet.code ? (
                          <p className="text-xs text-slate-500">
                            {outlet.code}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-500">
                        {formatNumber(outlet.itemCount)} items
                      </p>
                      <p className="text-right font-black text-slate-950">
                        {formatPeso(outlet.stockValue)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-sm text-slate-500">
                    No outlet inventory recorded yet.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionTitle
          icon={ReceiptText}
          title="Recent Money Movement"
          description="Latest recorded sales, payments, expenses, and slicing batches."
        />
        <div className="mt-4 grid gap-4 xl:grid-cols-4">
          <Card className="rounded-[2rem] border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-black">Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityList items={summary.recent.sales} emptyMessage="No sales recorded yet." />
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-black">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityList items={summary.recent.payments} emptyMessage="No payments recorded yet." />
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-black">Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityList items={summary.recent.expenses} emptyMessage="No expenses recorded yet." />
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-black">Slicing</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityList items={summary.recent.slicing} emptyMessage="No slicing batches recorded yet." />
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle
          icon={PackagePlus}
          title="Quick Operations"
          description="Common owner and cashier workflows in one desktop-style workspace."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            title="Sell Chicken"
            description="Create a pack-based chicken sale."
            href="/sales/new/chicken"
            icon={ShoppingCart}
          />
          <QuickAction
            title="Record Payment"
            description="Apply collection to customer balance."
            href="/payments/new"
            icon={WalletCards}
          />
          <QuickAction
            title="Add Expense"
            description="Track bodega operating expenses."
            href="/expenses-bodega"
            icon={ReceiptText}
          />
          <QuickAction
            title="New Slicing"
            description="Record daily slicing production."
            href="/slicing/new"
            icon={Scissors}
          />
        </div>
      </section>
    </div>
  );
}

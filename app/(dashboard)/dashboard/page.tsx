// app/(dashboard)/dashboard/page.tsx
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Package,
  PackagePlus,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary } from "@/lib/dashboard";
import { formatPeso } from "@/lib/utils";

function safePercent(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.min((value / total) * 100, 100);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  tone: "blue" | "emerald" | "rose" | "amber" | "slate" | "cyan";
}) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  };

  return (
    <Card className="rounded-3xl border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">{title}</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          </div>

          <div className={`rounded-2xl p-3 ring-1 ${toneMap[tone]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricLine({
  label,
  value,
  percent,
  tone = "bg-blue-600",
}: {
  label: string;
  value: string;
  percent: number;
  tone?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-bold text-slate-950">{value}</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${percent}%` }}
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
      className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50/40"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 group-hover:bg-red-100 group-hover:text-red-600">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <p className="font-bold text-slate-950">{title}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>

      <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-red-600" />
    </Link>
  );
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  const collectionRate = safePercent(summary.totalPayments, summary.totalSales);
  const receivableRate = safePercent(
    summary.outstandingReceivables,
    summary.totalSales
  );

  const todayTotal =
    summary.today.sales + summary.today.deliveries + summary.today.payments;

  const monthTotal =
    summary.thisMonth.sales +
    summary.thisMonth.deliveries +
    summary.thisMonth.payments;

  const currentDate = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
            <CalendarDays className="h-4 w-4" />
            {currentDate}
          </div>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Executive Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Real-time overview of customers, sales, deliveries, payments, and
            receivables.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/sales"
            className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
          >
            New Sale
          </Link>

          <Link
            href="/payments/add"
            className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Record Payment
          </Link>
        </div>
      </div>

      {summary.outstandingReceivables > 0 ? (
        <Card className="rounded-3xl border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-rose-600 shadow-sm">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <div>
                <p className="font-black text-rose-700">
                  Outstanding receivables need attention
                </p>
                <p className="text-sm text-rose-600">
                  Current unpaid customer balance is{" "}
                  <strong>{formatPeso(summary.outstandingReceivables)}</strong>.
                </p>
              </div>
            </div>

            <Link
              href="/payments"
              className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
            >
              View Balances
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-3xl border-emerald-200 bg-emerald-50 shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-2xl bg-white p-3 text-emerald-600 shadow-sm">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <div>
              <p className="font-black text-emerald-700">
                Receivables are clear
              </p>
              <p className="text-sm text-emerald-600">
                No outstanding customer balance detected.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Sales"
          value={formatPeso(summary.totalSales)}
          subtitle="All recorded sales"
          icon={ShoppingCart}
          tone="emerald"
        />

        <KpiCard
          title="Total Payments"
          value={formatPeso(summary.totalPayments)}
          subtitle={`${formatPercent(collectionRate)} collection rate`}
          icon={WalletCards}
          tone="blue"
        />

        <KpiCard
          title="Receivables"
          value={formatPeso(summary.outstandingReceivables)}
          subtitle={`${formatPercent(receivableRate)} of total sales`}
          icon={AlertTriangle}
          tone="rose"
        />

        <KpiCard
          title="Deliveries"
          value={formatPeso(summary.totalDeliveries)}
          subtitle="Total delivery value"
          icon={Package}
          tone="cyan"
        />

        <KpiCard
          title="Customers"
          value={summary.totalCustomers.toLocaleString()}
          subtitle="Active customer records"
          icon={Users}
          tone="slate"
        />

        <KpiCard
          title="Suppliers"
          value={summary.totalSuppliers.toLocaleString()}
          subtitle="Active supplier records"
          icon={Truck}
          tone="amber"
        />

        <KpiCard
          title="Today Sales"
          value={formatPeso(summary.today.sales)}
          subtitle="Sales generated today"
          icon={TrendingUp}
          tone="emerald"
        />

        <KpiCard
          title="Today Payments"
          value={formatPeso(summary.today.payments)}
          subtitle="Cash collected today"
          icon={CreditCard}
          tone="blue"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black">
              <BarChart3 className="h-5 w-5 text-red-600" />
              Business Performance
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Today
                  </p>
                  <p className="text-2xl font-black text-slate-950">
                    {formatPeso(todayTotal)}
                  </p>
                </div>

                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                  Daily activity
                </span>
              </div>

              <div className="space-y-4">
                <MetricLine
                  label="Sales"
                  value={formatPeso(summary.today.sales)}
                  percent={safePercent(summary.today.sales, todayTotal)}
                  tone="bg-emerald-600"
                />

                <MetricLine
                  label="Deliveries"
                  value={formatPeso(summary.today.deliveries)}
                  percent={safePercent(summary.today.deliveries, todayTotal)}
                  tone="bg-cyan-600"
                />

                <MetricLine
                  label="Payments"
                  value={formatPeso(summary.today.payments)}
                  percent={safePercent(summary.today.payments, todayTotal)}
                  tone="bg-blue-600"
                />
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    This Month
                  </p>
                  <p className="text-2xl font-black text-slate-950">
                    {formatPeso(monthTotal)}
                  </p>
                </div>

                <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                  Monthly activity
                </span>
              </div>

              <div className="space-y-4">
                <MetricLine
                  label="Sales"
                  value={formatPeso(summary.thisMonth.sales)}
                  percent={safePercent(summary.thisMonth.sales, monthTotal)}
                  tone="bg-emerald-600"
                />

                <MetricLine
                  label="Deliveries"
                  value={formatPeso(summary.thisMonth.deliveries)}
                  percent={safePercent(summary.thisMonth.deliveries, monthTotal)}
                  tone="bg-cyan-600"
                />

                <MetricLine
                  label="Payments"
                  value={formatPeso(summary.thisMonth.payments)}
                  percent={safePercent(summary.thisMonth.payments, monthTotal)}
                  tone="bg-blue-600"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black">
              <ClipboardList className="h-5 w-5 text-red-600" />
              Quick Operations
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <QuickAction
              title="Create Chicken Sale"
              description="Sell packed chicken products"
              href="/sales"
              icon={ShoppingCart}
            />

            <QuickAction
              title="Create Grocery Sale"
              description="Sell bodega grocery products"
              href="/sales/grocery"
              icon={ReceiptText}
            />

            <QuickAction
              title="Record Payment"
              description="Apply payment to customer balance"
              href="/payments/add"
              icon={WalletCards}
            />

            <QuickAction
              title="Add Purchase Batch"
              description="Stock-in purchased grocery items"
              href="/purchase-items"
              icon={PackagePlus}
            />

            <QuickAction
              title="Inventory Movement"
              description="Review stock in and stock out"
              href="/inventory/whole-chicken"
              icon={Boxes}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
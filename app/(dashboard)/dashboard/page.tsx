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

function SummaryBlock({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string;
  icon: any;
  items: {
    label: string;
    value: string;
  }[];
  tone: "emerald" | "blue" | "rose" | "cyan";
}) {
  const toneMap = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    rose: "bg-rose-50 text-rose-700",
    cyan: "bg-cyan-50 text-cyan-700",
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className={`rounded-2xl p-3 ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>

        <p className="font-black text-slate-950">{title}</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
          >
            <span className="text-sm font-medium text-slate-600">
              {item.label}
            </span>
            <span className="font-black text-slate-950">{item.value}</span>
          </div>
        ))}
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

  const financialMax = Math.max(
    summary.totalSales,
    summary.totalPayments,
    summary.outstandingReceivables,
    summary.totalStockInPurchases,
    1
  );

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
            Accounting-based overview of sales revenue, collections,
            receivables, and inventory received.
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
          subtitle="All recorded customer sales"
          icon={ShoppingCart}
          tone="emerald"
        />

        <KpiCard
          title="Total Payments Collected"
          value={formatPeso(summary.totalPayments)}
          subtitle="Cash collected from customers"
          icon={WalletCards}
          tone="blue"
        />

        <KpiCard
          title="Receivables"
          value={formatPeso(summary.outstandingReceivables)}
          subtitle="Unpaid customer balances"
          icon={AlertTriangle}
          tone="rose"
        />

        <KpiCard
          title="Stock In / Purchases"
          value={formatPeso(summary.totalStockInPurchases)}
          subtitle="Supplier-delivered inventory value"
          icon={Boxes}
          tone="cyan"
        />

        <KpiCard
          title="Today Sales"
          value={formatPeso(summary.today.sales)}
          subtitle="Sales created today"
          icon={TrendingUp}
          tone="emerald"
        />

        <KpiCard
          title="Today Payments"
          value={formatPeso(summary.today.payments)}
          subtitle="Payments created today"
          icon={CreditCard}
          tone="blue"
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
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black">
              <BarChart3 className="h-5 w-5 text-red-600" />
              Financial Summary
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">
                Accounting view
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Sales, collections, receivables, and stock-in values are shown
                separately. They are not added together to avoid double-counting.
              </p>
            </div>

            <div className="space-y-4">
              <MetricLine
                label="Sales Revenue"
                value={formatPeso(summary.totalSales)}
                percent={safePercent(summary.totalSales, financialMax)}
                tone="bg-emerald-600"
              />

              <MetricLine
                label="Cash Collected"
                value={formatPeso(summary.totalPayments)}
                percent={safePercent(summary.totalPayments, financialMax)}
                tone="bg-blue-600"
              />

              <MetricLine
                label="Unpaid Receivables"
                value={formatPeso(summary.outstandingReceivables)}
                percent={safePercent(
                  summary.outstandingReceivables,
                  financialMax
                )}
                tone="bg-rose-600"
              />

              <MetricLine
                label="Inventory Received"
                value={formatPeso(summary.totalStockInPurchases)}
                percent={safePercent(
                  summary.totalStockInPurchases,
                  financialMax
                )}
                tone="bg-cyan-600"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-emerald-700">
                  Collection Rate
                </p>
                <p className="mt-2 text-2xl font-black text-emerald-900">
                  {formatPercent(collectionRate)}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  Payments collected against total sales
                </p>
              </div>

              <div className="rounded-3xl bg-rose-50 p-5">
                <p className="text-sm font-semibold text-rose-700">
                  Receivable Rate
                </p>
                <p className="mt-2 text-2xl font-black text-rose-900">
                  {formatPercent(receivableRate)}
                </p>
                <p className="mt-1 text-xs text-rose-700">
                  Unpaid balance against total sales
                </p>
              </div>

              <div className="rounded-3xl bg-cyan-50 p-5">
                <p className="text-sm font-semibold text-cyan-700">
                  Stock In / Purchases
                </p>
                <p className="mt-2 text-2xl font-black text-cyan-900">
                  {formatPeso(summary.totalStockInPurchases)}
                </p>
                <p className="mt-1 text-xs text-cyan-700">
                  Inventory received, not revenue
                </p>
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
              title="Sell Chicken"
              description="Create chicken sale"
              href="/sales"
              icon={ShoppingCart}
            />

            <QuickAction
              title="Sale Grocery"
              description="Create grocery sale"
              href="/sales/grocery"
              icon={ReceiptText}
            />

            <QuickAction
              title="Record Payment"
              description="Collect customer payment"
              href="/payments/add"
              icon={CreditCard}
            />

            <QuickAction
              title="Purchase Items"
              description="Add purchased product stock"
              href="/purchase-items"
              icon={PackagePlus}
            />

            <QuickAction
              title="Supplier Deliveries"
              description="Record supplier stock-in"
              href="/deliveries"
              icon={Package}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <SummaryBlock
          title="Revenue"
          icon={ShoppingCart}
          tone="emerald"
          items={[
            {
              label: "Today Sales",
              value: formatPeso(summary.today.sales),
            },
            {
              label: "This Month Sales",
              value: formatPeso(summary.thisMonth.sales),
            },
          ]}
        />

        <SummaryBlock
          title="Collections"
          icon={WalletCards}
          tone="blue"
          items={[
            {
              label: "Today Payments Collected",
              value: formatPeso(summary.today.payments),
            },
            {
              label: "This Month Payments Collected",
              value: formatPeso(summary.thisMonth.payments),
            },
          ]}
        />

        <SummaryBlock
          title="Receivables"
          icon={AlertTriangle}
          tone="rose"
          items={[
            {
              label: "Current Unpaid Balance",
              value: formatPeso(summary.outstandingReceivables),
            },
            {
              label: "Receivable Rate",
              value: formatPercent(receivableRate),
            },
          ]}
        />

        <SummaryBlock
          title="Inventory Activity"
          icon={Boxes}
          tone="cyan"
          items={[
            {
              label: "Stock In / Purchases",
              value: formatPeso(summary.totalStockInPurchases),
            },
            {
              label: "Supplier Deliveries Value",
              value: formatPeso(summary.totalSupplierDeliveries),
            },
          ]}
        />
      </div>
    </div>
  );
}
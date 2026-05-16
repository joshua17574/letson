// app/(dashboard)/dashboard/page.tsx
import {
  AlertTriangle,
  CalendarDays,
  Info,
  Package,
  ShoppingCart,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary } from "@/lib/dashboard";
import { formatPeso } from "@/lib/utils";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="space-y-6">
      <Card className="border-blue-100 bg-white shadow-sm">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-slate-700">
          <Info className="h-5 w-5 text-blue-600" />
          Welcome back. Here&apos;s your business summary for today.
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
          <CalendarDays className="h-6 w-6" />
          Dashboard Overview
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Customers"
            value={summary.totalCustomers}
            icon={Users}
            className="bg-blue-600"
          />

          <StatCard
            title="Total Suppliers"
            value={summary.totalSuppliers}
            icon={Truck}
            className="bg-slate-600"
          />

          <StatCard
            title="Total Sales"
            value={formatPeso(summary.totalSales)}
            icon={ShoppingCart}
            className="bg-emerald-600"
          />

          <StatCard
            title="Total Deliveries"
            value={formatPeso(summary.totalDeliveries)}
            icon={Package}
            className="bg-cyan-500"
          />

          <StatCard
            title="Total Payments"
            value={formatPeso(summary.totalPayments)}
            icon={WalletCards}
            className="bg-slate-900"
          />

          <StatCard
            title="Outstanding Receivables"
            value={formatPeso(summary.outstandingReceivables)}
            icon={AlertTriangle}
            className="bg-rose-600"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 bg-slate-900 text-white shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-semibold">
            <p>Sales: {formatPeso(summary.today.sales)}</p>
            <p>Deliveries: {formatPeso(summary.today.deliveries)}</p>
            <p>Payments: {formatPeso(summary.today.payments)}</p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-cyan-500 text-white shadow-md">
          <CardHeader>
            <CardTitle className="text-base">This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-semibold">
            <p>Sales: {formatPeso(summary.thisMonth.sales)}</p>
            <p>Deliveries: {formatPeso(summary.thisMonth.deliveries)}</p>
            <p>Payments: {formatPeso(summary.thisMonth.payments)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { type QueryFilter, Types } from "mongoose";

import { cleanString, escapeRegex } from "@/lib/crud-utils";
import { buildDateRangeFilter, getUtcDateRange } from "@/lib/date-range";
import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import type { RolePermission } from "@/lib/role-permissions";
import CustomerModel, { type ICustomer } from "@/models/Customer";
import DeliveryModel, { type IDelivery } from "@/models/Delivery";
import PaymentModel, { type IPayment } from "@/models/Payment";
import SaleModel, { type ISale } from "@/models/Sale";
import SupplierModel, { type ISupplier } from "@/models/Supplier";

type SearchType = "ALL" | "CUSTOMERS" | "SALES" | "PAYMENTS" | "DELIVERIES";

type SearchResult = {
  _id: string;
  kind: "Customer" | "Sale" | "Payment" | "Delivery";
  title: string;
  subtitle: string;
  date: string;
  amount: number | null;
  href: string;
};

type SearchDocument = Record<string, unknown> & {
  _id: unknown;
};

const searchTypes: SearchType[] = [
  "ALL",
  "CUSTOMERS",
  "SALES",
  "PAYMENTS",
  "DELIVERIES",
];

function toSearchType(value: string): SearchType {
  const normalized = cleanString(value).toUpperCase();
  return searchTypes.includes(normalized as SearchType)
    ? (normalized as SearchType)
    : "ALL";
}

function canView(session: Session | null, permission: RolePermission) {
  if (!session) return false;

  const permissions = Array.isArray(session.user.permissions)
    ? session.user.permissions
    : [];

  return session.user.role === "ADMIN" || permissions.includes(permission);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function idString(value: unknown) {
  if (!value) return "";

  if (isRecord(value) && typeof value.toString === "function") {
    return value.toString();
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

function fieldText(record: Record<string, unknown>, field: string) {
  const value = record[field];
  return typeof value === "string" ? value : "";
}

function refId(value: unknown) {
  if (isRecord(value) && "_id" in value) {
    return idString(value._id);
  }

  return idString(value);
}

function refName(value: unknown) {
  if (isRecord(value)) {
    return fieldText(value, "name");
  }

  return "";
}

function subtitle(values: unknown[]) {
  return values
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean)
    .join(" | ");
}

function dateLabel(value: unknown) {
  if (!value) return "";
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function makeRegex(query: string) {
  return query ? { $regex: escapeRegex(query), $options: "i" } : null;
}

export async function GET(req: NextRequest) {
  const { response, session } = await requireApiAuth();
  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const query = cleanString(searchParams.get("q") || searchParams.get("search"));
  const type = toSearchType(cleanString(searchParams.get("type")));
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));
  const limitParam = Number(searchParams.get("limit") || 8);
  const limit = Math.trunc(
    Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 8, 1), 25)
  );
  const regex = makeRegex(query);
  const hasDateRange = Object.keys(getUtcDateRange(dateFrom, dateTo)).length > 0;
  const hasTypeFilter = type !== "ALL";

  if (!query && !hasDateRange && !hasTypeFilter) {
    return NextResponse.json({
      success: true,
      data: [],
      meta: {
        query,
        type,
        total: 0,
      },
    });
  }

  const wants = (kind: SearchType) => type === "ALL" || type === kind;
  const results: SearchResult[] = [];
  let customerIds: Types.ObjectId[] = [];
  let supplierIds: Types.ObjectId[] = [];

  if (regex && (wants("SALES") || wants("PAYMENTS"))) {
    const matchingCustomerFilter: QueryFilter<ICustomer> = {
      isActive: true,
      name: regex,
    };

    const matchingCustomers = await CustomerModel.find(matchingCustomerFilter)
      .select("_id")
      .limit(100)
      .lean();

    customerIds = matchingCustomers.map((customer) => customer._id);
  }

  if (regex && wants("DELIVERIES")) {
    const matchingSupplierFilter: QueryFilter<ISupplier> = {
      isActive: true,
      name: regex,
    };

    const matchingSuppliers = await SupplierModel.find(matchingSupplierFilter)
      .select("_id")
      .limit(100)
      .lean();

    supplierIds = matchingSuppliers.map((supplier) => supplier._id);
  }

  const searches: Promise<void>[] = [];

  if (wants("CUSTOMERS") && canView(session, "customers.view")) {
    const customerFilter: QueryFilter<ICustomer> = {
      isActive: true,
      ...buildDateRangeFilter("createdAt", dateFrom, dateTo),
    };

    if (regex) {
      customerFilter.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { address: regex },
      ];
    }

    searches.push(
      CustomerModel.find(customerFilter)
        .sort({ name: 1 })
        .limit(limit)
        .lean()
        .then((customers) => {
          const customerRows = customers as unknown as SearchDocument[];

          results.push(
            ...customerRows.map((customer) => ({
              _id: idString(customer._id),
              kind: "Customer" as const,
              title: fieldText(customer, "name") || "Unnamed customer",
              subtitle: subtitle([
                fieldText(customer, "type"),
                fieldText(customer, "phone"),
                fieldText(customer, "email"),
              ]),
              date: dateLabel(customer.createdAt),
              amount: null,
              href: `/payments/add?customerId=${idString(customer._id)}`,
            }))
          );
        })
    );
  }

  if (wants("SALES") && canView(session, "sales.view")) {
    const saleFilter: QueryFilter<ISale> = {
      isVoided: false,
      ...buildDateRangeFilter("saleDate", dateFrom, dateTo),
    };

    if (regex) {
      saleFilter.$or = [
        { receiptNumber: regex },
        { remarks: regex },
        { customerId: { $in: customerIds } },
      ];
    }

    searches.push(
      SaleModel.find(saleFilter)
        .populate("customerId", "name")
        .sort({ saleDate: -1, createdAt: -1 })
        .limit(limit)
        .lean()
        .then((sales) => {
          const saleRows = sales as unknown as SearchDocument[];

          results.push(
            ...saleRows.map((sale) => ({
              _id: idString(sale._id),
              kind: "Sale" as const,
              title:
                fieldText(sale, "receiptNumber") ||
                `Sale ${idString(sale._id).slice(-6)}`,
              subtitle: subtitle([
                refName(sale.customerId),
                fieldText(sale, "status"),
                fieldText(sale, "source"),
              ]),
              date: dateLabel(sale.saleDate),
              amount: money(sale.totalAmount),
              href: "/sales/history",
            }))
          );
        })
    );
  }

  if (wants("PAYMENTS") && canView(session, "payments.view")) {
    const paymentFilter: QueryFilter<IPayment> = {
      isVoided: false,
      ...buildDateRangeFilter("paymentDate", dateFrom, dateTo),
    };

    if (regex) {
      paymentFilter.$or = [
        { referenceNumber: regex },
        { remarks: regex },
        { customerId: { $in: customerIds } },
      ];
    }

    searches.push(
      PaymentModel.find(paymentFilter)
        .populate("customerId", "name")
        .sort({ paymentDate: -1, createdAt: -1 })
        .limit(limit)
        .lean()
        .then((payments) => {
          const paymentRows = payments as unknown as SearchDocument[];

          results.push(
            ...paymentRows.map((payment) => {
              const customerId = refId(payment.customerId);

              return {
                _id: idString(payment._id),
                kind: "Payment" as const,
                title:
                  fieldText(payment, "referenceNumber") ||
                  `Payment ${idString(payment._id).slice(-6)}`,
                subtitle: subtitle([
                  refName(payment.customerId),
                  fieldText(payment, "remarks"),
                ]),
                date: dateLabel(payment.paymentDate),
                amount: money(payment.amount),
                href: customerId
                  ? `/payments/add?customerId=${customerId}`
                  : "/payments/history",
              };
            })
          );
        })
    );
  }

  if (wants("DELIVERIES") && canView(session, "supplier-deliveries.view")) {
    const deliveryFilter: QueryFilter<IDelivery> = {
      isVoided: false,
      ...buildDateRangeFilter("deliveryDate", dateFrom, dateTo),
    };

    if (regex) {
      deliveryFilter.$or = [
        { deliveryCode: regex },
        { receiptNumber: regex },
        { remarks: regex },
        { supplierId: { $in: supplierIds } },
      ];
    }

    searches.push(
      DeliveryModel.find(deliveryFilter)
        .populate("supplierId", "name")
        .sort({ deliveryDate: -1, createdAt: -1 })
        .limit(limit)
        .lean()
        .then((deliveries) => {
          const deliveryRows = deliveries as unknown as SearchDocument[];

          results.push(
            ...deliveryRows.map((delivery) => ({
              _id: idString(delivery._id),
              kind: "Delivery" as const,
              title:
                fieldText(delivery, "deliveryCode") ||
                fieldText(delivery, "receiptNumber") ||
                `Delivery ${idString(delivery._id).slice(-6)}`,
              subtitle: subtitle([
                refName(delivery.supplierId),
                fieldText(delivery, "receiptNumber"),
              ]),
              date: dateLabel(delivery.deliveryDate),
              amount: money(delivery.totalAmount),
              href: "/deliveries",
            }))
          );
        })
    );
  }

  await Promise.all(searches);

  results.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeB - timeA;
  });

  return NextResponse.json({
    success: true,
    data: results,
    meta: {
      query,
      type,
      total: results.length,
    },
  });
}

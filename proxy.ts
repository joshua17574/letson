import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

type PageRule = {
  exact?: string;
  prefix?: string;
  permission: string;
};

const PAGE_RULES: PageRule[] = [
  { prefix: "/profit/chicken-slicing", permission: "reports.profit" },
  { prefix: "/reports/chicken-slicing", permission: "reports.profit" },
  { exact: "/dashboard", permission: "dashboard.view" },
  { prefix: "/customers", permission: "customers.view" },
  { prefix: "/suppliers", permission: "suppliers.view" },
  { prefix: "/categories", permission: "categories.view" },
  { prefix: "/products", permission: "products.view" },
  { prefix: "/bodega-products", permission: "bodega-products.view" },
  { prefix: "/purchase-items", permission: "purchase-items.view" },
  { prefix: "/deliveries", permission: "supplier-deliveries.view" },
  { prefix: "/slicing/new", permission: "slicing.manage" },
  { prefix: "/slicing/standard-packing", permission: "standard-packing.view" },
  { prefix: "/slicing", permission: "slicing.view" },
  { prefix: "/sales/history", permission: "sales.view" },
  { prefix: "/sales/lines", permission: "sales-lines.view" },
  { prefix: "/sales/grocery", permission: "sales.manage" },
  { exact: "/sales", permission: "sales.manage" },
  { prefix: "/payments/add", permission: "payments.manage" },
  { prefix: "/payments/history", permission: "payments.view" },
  { prefix: "/payments", permission: "payments.view" },
  { prefix: "/inventory", permission: "inventory.view" },
  { prefix: "/reports/sales", permission: "reports.sales" },
  { prefix: "/reports/inventory", permission: "reports.inventory" },
  { prefix: "/reports/payments", permission: "reports.payments" },
  { prefix: "/reports/profit", permission: "reports.profit" },
  { prefix: "/users", permission: "users.view" },
  { prefix: "/roles", permission: "roles.view" },
  { prefix: "/expenses-bodega", permission: "expenses-bodega.view" },
];

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function matchesRule(pathname: string, rule: PageRule) {
  const path = normalizePath(pathname);

  if (rule.exact) {
    return path === rule.exact;
  }

  if (rule.prefix) {
    return path === rule.prefix || path.startsWith(`${rule.prefix}/`);
  }

  return false;
}

function getRequiredPermission(pathname: string) {
  const rule = PAGE_RULES.find((item) => matchesRule(pathname, item));
  return rule?.permission ?? null;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requiredPermission = getRequiredPermission(pathname);

  if (!requiredPermission) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const permissions = Array.isArray((token as { permissions?: unknown }).permissions)
    ? (token as { permissions: string[] }).permissions
    : [];

  if (!permissions.includes(requiredPermission)) {
    const unauthorizedUrl = request.nextUrl.clone();
    unauthorizedUrl.pathname = "/unauthorized";
    unauthorizedUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(unauthorizedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/profit/:path*",
    "/dashboard/:path*",
    "/customers/:path*",
    "/suppliers/:path*",
    "/categories/:path*",
    "/products/:path*",
    "/bodega-products/:path*",
    "/purchase-items/:path*",
    "/deliveries/:path*",
    "/slicing/:path*",
    "/sales/:path*",
    "/payments/:path*",
    "/inventory/:path*",
    "/reports/:path*",
    "/users/:path*",
    "/roles/:path*",
    "/expenses-bodega/:path*",
  ],
};

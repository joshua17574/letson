// components/app-shell/nav-config.ts
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardList,
  Clock,
  CreditCard,
  Gauge,
  LayoutDashboard,
  Package,
  PackagePlus,
  ReceiptText,
  Scissors,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Truck,
  Tags,
  Users,
  UserRoundCog,
  WalletCards,
} from "lucide-react";

export type AppNavItem = {
  title: string;
  href?: string;
  icon: any;
  permission?: string;
  children?: {
    title: string;
    href: string;
    icon?: any;
    permission?: string;
  }[];
};

export const appNavItems: AppNavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.view",
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    permission: "customers.view",
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    icon: Truck,
    permission: "suppliers.view",
  },
  {
    title: "Categories",
    href: "/categories",
    icon: Tags,
    permission: "categories.view",
  },
  {
    title: "Products",
    icon: Package,
    permission: "products.view",
    children: [
      {
        title: "Products",
        href: "/products",
        icon: Package,
        permission: "products.view",
      },
      {
        title: "Bodega Products",
        href: "/bodega-products",
        icon: Boxes,
        permission: "bodega-products.view",
      },
    ],
  },
  {
    title: "Purchase Item",
    href: "/purchase-items",
    icon: PackagePlus,
    permission: "purchase-items.view",
  },
  {
    title: "Deliveries",
    href: "/deliveries",
    icon: Truck,
    permission: "supplier-deliveries.view",
  },
  {
    title: "Slicing",
    icon: Scissors,
    permission: "slicing.view",
    children: [
      {
        title: "Slice History",
        href: "/slicing",
        icon: Clock,
        permission: "slicing.view",
      },
      {
        title: "Add Slicing",
        href: "/slicing/new",
        icon: Scissors,
        permission: "slicing.manage",
      },
      {
        title: "Standard PCS & Packs",
        href: "/slicing/standard-packing",
        icon: Boxes,
        permission: "standard-packing.view",
      },
    ],
  },
  {
    title: "Sales",
    icon: ShoppingCart,
    permission: "sales.view",
    children: [
      {
        title: "Sell Chicken",
        href: "/sales",
        icon: ShoppingCart,
        permission: "sales.manage",
      },
      {
        title: "Sale Grocery",
        href: "/sales/grocery",
        icon: ShoppingBasket,
        permission: "sales.manage",
      },
      {
        title: "Sales History",
        href: "/sales/history",
        icon: Clock,
        permission: "sales.view",
      },
      {
        title: "Sale Per Item",
        href: "/sales/lines",
        icon: ReceiptText,
        permission: "sales-lines.view",
      },
    ],
  },
  {
    title: "Payments",
    icon: WalletCards,
    permission: "payments.view",
    children: [
      {
        title: "Payment Summary",
        href: "/payments",
        icon: ClipboardList,
        permission: "payments.view",
      },
      {
        title: "Add Payment",
        href: "/payments/add",
        icon: CreditCard,
        permission: "payments.manage",
      },
      {
        title: "Payment History",
        href: "/payments/history",
        icon: Clock,
        permission: "payments.view",
      },
    ],
  },
  {
    title: "Inventory",
    icon: Boxes,
    permission: "inventory.view",
    children: [
      {
        title: "Whole Chicken Movement",
        href: "/inventory/whole-chicken",
        icon: ArrowLeftRight,
        permission: "inventory.view",
      },
      {
        title: "Bodega Stock Movement",
        href: "/inventory/bodega",
        icon: ArrowLeftRight,
        permission: "inventory.view",
      },
    ],
  },
  {
    title: "Reports",
    icon: BarChart3,
    permission: "reports.sales",
    children: [
        { title: "Chicken Slicing Profit", href: "/reports/chicken-slicing", icon: BarChart3, permission: "reports.profit" },
      {
        title: "Sales Report",
        href: "/reports/sales",
        icon: BarChart3,
        permission: "reports.sales",
      },
      {
        title: "Inventory Report",
        href: "/reports/inventory",
        icon: Boxes,
        permission: "reports.inventory",
      },
      {
        title: "Payment Report",
        href: "/reports/payments",
        icon: CreditCard,
        permission: "reports.payments",
      },
      {
        title: "Profit Report",
        href: "/reports/profit",
        icon: Gauge,
        permission: "reports.profit",
      },
    ],
  },
  {
    title: "Users",
    href: "/users",
    icon: UserRoundCog,
    permission: "users.view",
  },
  {
    title: "Roles",
    href: "/roles",
    icon: ShieldCheck,
    permission: "roles.view",
  },
];

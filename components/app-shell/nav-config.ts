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
  ShoppingBasket,
  ShoppingCart,
  Truck,
  Tags,
  Users,
  UserRoundCog,
  WalletCards,
  Banknote,
} from "lucide-react";

export type AppNavItem = {
  title: string;
  href?: string;
  icon: any;
  children?: {
    title: string;
    href: string;
    icon?: any;
  }[];
};

export const appNavItems: AppNavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    icon: Truck,
  },
  {
    title: "Categories",
    href: "/categories",
    icon: Tags,
  },
  {
    title: "Products",
    icon: Package,
    children: [
      {
        title: "Grocery Products",
        href: "/products",
        icon: Package,
      },
      {
        title: "Bodega Products",
        href: "/bodega-products",
        icon: Boxes,
      },
    ],
  },
  {
    title: "Purchase Item",
    href: "/purchase-items",
    icon: PackagePlus,
  },
  {
    title: "Deliveries",
    href: "/deliveries",
    icon: Truck,
  },
  {
    title: "Slicing",
    icon: Scissors,
    children: [      
      {
        title: "Add Slicing",
        href: "/slicing/new",
        icon: Scissors,
      },
      {
        title: "Standard PCS & Packs",
        href: "/slicing/standard-packing",
        icon: Boxes,
      },
      {
        title: "Slice History",
        href: "/slicing",
        icon: Clock,
      },
    ],
  },
  {
    title: "Sales",
    icon: ShoppingCart,
    children: [
      {
        title: "Sell Chicken",
        href: "/sales",
        icon: ShoppingCart,
      },
      {
        title: "Sale Grocery",
        href: "/sales/grocery",
        icon: ShoppingBasket,
      },
      {
        title: "Sales History",
        href: "/sales/history",
        icon: Clock,
      },
      {
        title: "Sale Per Item",
        href: "/sales/lines",
        icon: ReceiptText,
      },
    ],
  },
  {
    title: "Payments",
    icon: WalletCards,
    children: [
      {
        title: "Payment Summary",
        href: "/payments",
        icon: ClipboardList,
      },
      {
        title: "Add Payment",
        href: "/payments/add",
        icon: CreditCard,
      },
      {
        title: "Payment History",
        href: "/payments/history",
        icon: Clock,
      },
    ],
  },
  {
    title: "Inventory",
    icon: Boxes,
    children: [
      {
        title: "Grocery Stock Movement",
        href: "/inventory/whole-chicken",
        icon: ArrowLeftRight,
      },
      {
        title: "Bodega Stock Movement",
        href: "/inventory/bodega",
        icon: ArrowLeftRight,
      },
    ],
  },

  {
  title: "Expenses Bodega",
  href: "/expenses-bodega",
  icon: Banknote,
},

  {
    title: "Reports",
    icon: BarChart3,
    children: [
      {
        title: "Sales Report",
        href: "/reports/sales",
        icon: BarChart3,
      },
      {
        title: "Inventory Report",
        href: "/reports/inventory",
        icon: Boxes,
      },
      {
        title: "Payment Report",
        href: "/reports/payments",
        icon: CreditCard,
      },
      {
        title: "Profit Report",
        href: "/reports/profit",
        icon: Gauge,
      },
    ],
  },
  {
    title: "Users",
    href: "/users",
    icon: UserRoundCog,
  },
];
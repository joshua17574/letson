export const ROLE_PERMISSION_GROUPS = [
  {
    group: "Dashboard",
    permissions: [{ key: "dashboard.view", label: "View Dashboard" }],
  },
  {
    group: "Master Data",
    permissions: [
      { key: "customers.view", label: "View Customers" },
      { key: "customers.manage", label: "Manage Customers" },
      { key: "suppliers.view", label: "View Suppliers" },
      { key: "suppliers.manage", label: "Manage Suppliers" },
      { key: "categories.view", label: "View Categories" },
      { key: "categories.manage", label: "Manage Categories" },
      { key: "products.view", label: "View Products" },
      { key: "products.manage", label: "Manage Products" },
      { key: "bodega-products.view", label: "View Bodega Products" },
      { key: "bodega-products.manage", label: "Manage Bodega Products" },
    ],
  },
  {
    group: "Purchasing / Stock-In",
    permissions: [
      { key: "purchase-items.view", label: "View Purchase Items" },
      { key: "purchase-items.manage", label: "Manage Purchase Items" },
      { key: "supplier-deliveries.view", label: "View Supplier Deliveries" },
      { key: "supplier-deliveries.manage", label: "Manage Supplier Deliveries" },
    ],
  },
  {
    group: "Production",
    permissions: [
      { key: "slicing.view", label: "View Slicing" },
      { key: "slicing.manage", label: "Manage Slicing" },
      { key: "standard-packing.view", label: "View Standard PCS & Packs" },
      { key: "standard-packing.manage", label: "Manage Standard PCS & Packs" },
    ],
  },
  {
    group: "Sales",
    permissions: [
      { key: "sales.view", label: "View Sales" },
      { key: "sales.manage", label: "Manage Sales" },
      { key: "sales-lines.view", label: "View Sales Per Item" },
    ],
  },
  {
    group: "Payments",
    permissions: [
      { key: "payments.view", label: "View Payments" },
      { key: "payments.manage", label: "Manage Payments" },
    ],
  },
  {
    group: "Expenses",
    permissions: [
      { key: "expenses-bodega.view", label: "View Business Expenses" },
      { key: "expenses-bodega.manage", label: "Manage Business Expenses" },
    ],
  },
  {
    group: "Inventory",
    permissions: [
      { key: "inventory.view", label: "View Inventory" },
      { key: "inventory.manage", label: "Manage Inventory" },
      { key: "stock-adjustment.manage", label: "Manage Stock Adjustment" },
    ],
  },
  {
    group: "Reports",
    permissions: [
      { key: "reports.sales", label: "Sales Report" },
      { key: "reports.inventory", label: "Inventory Report" },
      { key: "reports.payments", label: "Payment Report" },
      { key: "reports.customer-balance", label: "Customer Balance Report" },
      { key: "reports.product-movement", label: "Product Movement Report" },
      { key: "reports.profit", label: "Profit Report" },
    ],
  },
  {
    group: "System",
    permissions: [
      { key: "users.view", label: "View Users" },
      { key: "users.manage", label: "Manage Users" },
      { key: "roles.view", label: "View Roles" },
      { key: "roles.manage", label: "Manage Roles" },
      { key: "activity-logs.view", label: "View Activity Logs" },
      { key: "settings.manage", label: "Manage Settings" },
    ],
  },
] as const;

export const ROLE_PERMISSION_KEYS = ROLE_PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
);

export type RolePermission = (typeof ROLE_PERMISSION_KEYS)[number];

export function isValidRolePermission(value: string) {
  return ROLE_PERMISSION_KEYS.includes(value as RolePermission);
}

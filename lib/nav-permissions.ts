// lib/nav-permissions.ts
import type { AppNavItem } from "@/components/app-shell/nav-config";

export function hasPermission(
  userPermissions: string[] = [],
  requiredPermission?: string
) {
  if (!requiredPermission) return true;

  return userPermissions.includes(requiredPermission);
}

export function filterNavByPermissions(
  navItems: AppNavItem[],
  userPermissions: string[] = []
): AppNavItem[] {
  return navItems
    .map((item) => {
      const children = item.children?.filter((child) =>
        hasPermission(userPermissions, child.permission)
      );

      const canViewParent = hasPermission(userPermissions, item.permission);

      if (children && children.length > 0) {
        return {
          ...item,
          children,
        };
      }

      if (canViewParent && !item.children) {
        return item;
      }

      return null;
    })
    .filter(Boolean) as AppNavItem[];
}
// components/app-shell/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X,
} from "lucide-react";

import { LetsonMark } from "@/components/brand/LetsonMark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appNavItems, AppNavItem } from "./nav-config";

type Props = {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onToggle: () => void;
};

type SessionUserWithPermissions = {
  permissions?: unknown;
  role?: unknown;
  roleName?: unknown;
};

function isRouteActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/sales") return pathname === "/sales";
  if (href === "/slicing") return pathname === "/slicing";
  if (href === "/payments") return pathname === "/payments";
  if (href === "/products") return pathname === "/products";

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isItemActive(pathname: string, item: AppNavItem) {
  if (item.href) {
    return isRouteActive(pathname, item.href);
  }

  if (item.children) {
    return item.children.some((child) => isRouteActive(pathname, child.href));
  }

  return false;
}

function hasPermission(
  userPermissions: string[],
  requiredPermission?: string,
  isAdmin = false
) {
  if (isAdmin) return true;
  if (!requiredPermission) return true;

  return userPermissions.includes(requiredPermission);
}

function filterNavItemsByPermissions(
  navItems: AppNavItem[],
  userPermissions: string[],
  isAdmin = false
) {
  return navItems
    .map((item) => {
      const visibleChildren = item.children?.filter((child) =>
        hasPermission(userPermissions, child.permission, isAdmin)
      );

      const canViewParent = hasPermission(
        userPermissions,
        item.permission,
        isAdmin
      );

      if (visibleChildren && visibleChildren.length > 0) {
        return {
          ...item,
          children: visibleChildren,
        };
      }

      if (canViewParent && !item.children) {
        return item;
      }

      return null;
    })
    .filter(Boolean) as AppNavItem[];
}

function getActiveParentTitle(pathname: string, navItems: AppNavItem[]) {
  const activeParent = navItems.find((item) => {
    if (!item.children) return false;
    return item.children.some((child) => isRouteActive(pathname, child.href));
  });

  return activeParent?.title || null;
}

export function AppSidebar({
  collapsed,
  mobileOpen,
  onMobileClose,
  onToggle,
}: Props) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const effectiveCollapsed = collapsed && !mobileOpen;

  const sessionUser = session?.user as SessionUserWithPermissions | undefined;

  const userPermissions = useMemo(() => {
    return Array.isArray(sessionUser?.permissions)
      ? sessionUser.permissions.filter(
          (permission): permission is string => typeof permission === "string"
        )
      : [];
  }, [sessionUser]);

  const legacyRole = String(sessionUser?.role || "").toUpperCase();
  const roleName = String(sessionUser?.roleName || "").toUpperCase();

  const isAdmin = legacyRole === "ADMIN" || roleName === "ADMIN";

  const visibleNavItems = useMemo(() => {
    if (status === "loading") return [];

    return filterNavItemsByPermissions(appNavItems, userPermissions, isAdmin);
  }, [status, userPermissions, isAdmin]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const activeParentTitle = getActiveParentTitle(pathname, visibleNavItems);
      setOpenGroup(activeParentTitle);
    });

    return () => cancelAnimationFrame(frame);
  }, [pathname, visibleNavItems]);

  function handleMainNavClick() {
    setOpenGroup(null);
    onMobileClose();
  }

  function handleGroupClick(title: string) {
    setOpenGroup((current) => (current === title ? null : title));
  }

  return (
    <aside
      data-mobile-open={mobileOpen ? "true" : "false"}
      className={cn(
        "brand-sidebar mobile-sidebar fixed left-0 top-0 z-40 flex h-dvh flex-col border-r border-sidebar-border text-sidebar-foreground shadow-[18px_0_60px_-44px_color-mix(in_oklch,var(--primary)_58%,transparent)] transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        effectiveCollapsed
          ? "w-[84px]"
          : "w-[min(calc(100vw-1.5rem),292px)] lg:w-[292px]"
      )}
    >
      <div className="hairline-highlight flex h-20 items-center justify-between px-4">
        <Link
          href="/dashboard"
          className="group flex items-center gap-3 rounded-2xl outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={handleMainNavClick}
        >
          <div className="flex h-12 w-12 items-center justify-center transition duration-200 group-hover:-translate-y-0.5">
            <LetsonMark className="h-12 w-12" />
          </div>

          {!effectiveCollapsed ? (
            <div className="text-center leading-tight">
              <p className="text-2xl font-black tracking-tight text-primary">
                ISAY
              </p>
              <p className="text-xs font-semibold text-sidebar-accent-foreground/72">
                Fried Chicken
              </p>
            </div>
          ) : null}
        </Link>

        {!effectiveCollapsed ? (
          <Button
            type="button"
            aria-label="Collapse navigation"
            size="icon"
            variant="ghost"
            onClick={onToggle}
            className="hidden h-9 w-9 rounded-xl border border-primary/25 bg-white/85 text-primary shadow-[0_10px_24px_-18px_color-mix(in_oklch,var(--primary)_82%,transparent)] hover:border-primary/40 hover:bg-white hover:text-primary lg:inline-flex dark:bg-background/70"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.7} />
          </Button>
        ) : null}

        <Button
          type="button"
          aria-label="Close navigation"
          size="icon"
          variant="ghost"
          onClick={onMobileClose}
          className="h-10 w-10 rounded-xl border border-primary/25 bg-white/85 text-primary shadow-[0_10px_24px_-18px_color-mix(in_oklch,var(--primary)_82%,transparent)] hover:border-primary/40 hover:bg-white hover:text-primary lg:hidden dark:bg-background/70"
        >
          <X className="h-5 w-5" strokeWidth={2.7} />
        </Button>
      </div>

      {effectiveCollapsed ? (
        <div className="px-4 pb-3">
          <Button
            type="button"
            aria-label="Expand navigation"
            size="icon"
            variant="ghost"
            onClick={onToggle}
            className="hidden h-10 w-10 rounded-xl border border-primary/25 bg-white/85 text-primary shadow-[0_10px_24px_-18px_color-mix(in_oklch,var(--primary)_82%,transparent)] hover:border-primary/40 hover:bg-white hover:text-primary lg:inline-flex dark:bg-background/70"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.7} />
          </Button>
        </div>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-6">
        {visibleNavItems.map((item) => {
          const active = isItemActive(pathname, item);
          const Icon = item.icon;
          const isOpen = openGroup === item.title;

          if (!item.children) {
            return (
              <Link
                key={item.title}
                href={item.href || "#"}
                onClick={handleMainNavClick}
                className={cn(
                  "group relative flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "sidebar-nav-active"
                    : "sidebar-nav-muted",
                  effectiveCollapsed && "justify-center px-0"
                )}
                title={effectiveCollapsed ? item.title : undefined}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    active ? "text-primary-foreground" : "text-current"
                  )}
                />

                {!effectiveCollapsed ? <span>{item.title}</span> : null}
              </Link>
            );
          }

          return (
            <div key={item.title} className="space-y-1">
              <button
                type="button"
                onClick={() => handleGroupClick(item.title)}
                className={cn(
                  "flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold transition duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
                  active || isOpen
                    ? "sidebar-group-active"
                    : "sidebar-nav-muted",
                  effectiveCollapsed && "justify-center px-0"
                )}
                title={effectiveCollapsed ? item.title : undefined}
              >
                <Icon className="h-5 w-5 shrink-0 text-current" />

                {!effectiveCollapsed ? (
                  <>
                    <span className="flex-1">{item.title}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </>
                ) : null}
              </button>

              {!effectiveCollapsed && isOpen ? (
                <div className="sidebar-child-rail motion-stagger ml-4 space-y-1 border-l pl-3">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    const childActive = isRouteActive(pathname, child.href);

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onMobileClose}
                        className={cn(
                          "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
                          childActive
                            ? "sidebar-nav-active"
                            : "sidebar-nav-muted"
                        )}
                      >
                        {ChildIcon ? (
                          <ChildIcon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              childActive ? "text-primary-foreground" : "text-current"
                            )}
                          />
                        ) : null}

                        <span>{child.title}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

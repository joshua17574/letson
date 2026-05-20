// components/app-shell/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flame,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appNavItems, AppNavItem } from "./nav-config";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
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

function getActiveParentTitle(pathname: string) {
  const activeParent = appNavItems.find((item) => {
    if (!item.children) return false;
    return item.children.some((child) => isRouteActive(pathname, child.href));
  });

  return activeParent?.title || null;
}

export function AppSidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    const activeParentTitle = getActiveParentTitle(pathname);
    setOpenGroup(activeParentTitle);
  }, [pathname]);

  function handleMainNavClick() {
    setOpenGroup(null);
  }

  function handleGroupClick(title: string) {
    setOpenGroup((current) => (current === title ? null : title));
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-red-200 bg-gradient-to-b from-[#ff1f1f] via-[#ff5a00] to-[#ffb000] text-white shadow-xl transition-all duration-300",
        collapsed ? "w-[84px]" : "w-[292px]"
      )}
    >
      <div className="flex h-20 items-center justify-between px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-3"
          onClick={handleMainNavClick}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md">
            <Flame className="h-7 w-7 text-red-600" />
          </div>

          {!collapsed ? (
            <div className="leading-tight">
              <p className="text-2xl font-black tracking-tight text-white">
                ISAY
              </p>
              <p className="text-xs font-semibold text-white/80">
                Fried Chicken
              </p>
            </div>
          ) : null}
        </Link>

        {!collapsed ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onToggle}
            className="h-9 w-9 rounded-xl text-white hover:bg-white/20 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : null}
      </div>

      {collapsed ? (
        <div className="px-4 pb-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onToggle}
            className="h-10 w-10 rounded-xl bg-white/15 text-white hover:bg-white/25 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {appNavItems.map((item) => {
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
                  "group flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition",
                  active
                    ? "bg-white text-red-600 shadow-md"
                    : "text-white/95 hover:bg-white/18 hover:text-white",
                  collapsed && "justify-center px-0"
                )}
                title={collapsed ? item.title : undefined}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    active ? "text-red-600" : "text-white"
                  )}
                />

                {!collapsed ? <span>{item.title}</span> : null}
              </Link>
            );
          }

          return (
            <div key={item.title} className="space-y-1">
              <button
                type="button"
                onClick={() => handleGroupClick(item.title)}
                className={cn(
                  "flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold transition",
                  active || isOpen
                    ? "bg-white/25 text-white"
                    : "text-white/95 hover:bg-white/18",
                  collapsed && "justify-center px-0"
                )}
                title={collapsed ? item.title : undefined}
              >
                <Icon className="h-5 w-5 shrink-0 text-white" />

                {!collapsed ? (
                  <>
                    <span className="flex-1">{item.title}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-white/80" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white/80" />
                    )}
                  </>
                ) : null}
              </button>

              {!collapsed && isOpen ? (
                <div className="ml-4 space-y-1 border-l border-white/20 pl-3">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    const childActive = isRouteActive(pathname, child.href);

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                          childActive
                            ? "bg-white text-red-600 shadow-sm"
                            : "text-white/90 hover:bg-white/18 hover:text-white"
                        )}
                      >
                        {ChildIcon ? (
                          <ChildIcon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              childActive ? "text-red-600" : "text-white"
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
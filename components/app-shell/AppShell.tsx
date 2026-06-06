// components/app-shell/AppShell.tsx
"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";

type Props = {
  children: React.ReactNode;
};

export function AppShell({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("letson-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        localStorage.setItem("letson-sidebar-collapsed", String(next));
      }
      return next;
    });
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block">
        <AppSidebar collapsed={mounted ? collapsed : false} onToggle={toggleSidebar} />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={closeMobileMenu}
          />
          <div className="absolute inset-y-0 left-0">
            <AppSidebar
              collapsed={false}
              mobile
              onToggle={closeMobileMenu}
              onNavigate={closeMobileMenu}
            />
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-300 ease-out",
          mounted && collapsed ? "lg:pl-20" : "lg:pl-[280px]"
        )}
      >
        <AppTopbar
          collapsed={mounted ? collapsed : false}
          onToggle={toggleSidebar}
          onMobileMenu={() => setMobileOpen(true)}
        />

        <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 lg:px-6 lg:py-6">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-3 shadow-sm shadow-slate-200/70 backdrop-blur sm:p-4 lg:p-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

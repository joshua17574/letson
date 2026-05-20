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

  useEffect(() => {
    const saved = localStorage.getItem("isay-sidebar-collapsed");

    if (saved === "true") {
      setCollapsed(true);
    }
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("isay-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <AppSidebar collapsed={collapsed} onToggle={toggleSidebar} />

      <div
        className={cn(
          "min-h-screen transition-all duration-300",
          collapsed ? "pl-[84px]" : "pl-[292px]"
        )}
      >
        <AppTopbar collapsed={collapsed} onToggle={toggleSidebar} />

        <main className="mx-auto w-full max-w-[1800px] px-6 py-6">
          <div className="min-h-[calc(100vh-112px)] rounded-[28px] border border-slate-200 bg-white/70 p-6 shadow-sm">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
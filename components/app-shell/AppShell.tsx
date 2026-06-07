// components/app-shell/AppShell.tsx
"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";

type Props = {
  children: React.ReactNode;
  session: Session;
};

export function AppShell({ children, session }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = localStorage.getItem("isay-sidebar-collapsed");

      if (saved === "true") {
        setCollapsed(true);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("isay-sidebar-collapsed", String(next));
      return next;
    });
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMobileSidebarOpen(false);
    });

    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <SessionProvider session={session}>
      <div className="surface-shell min-h-dvh overflow-x-hidden text-foreground">
        {mobileSidebarOpen ? (
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        ) : null}

        <AppSidebar
          collapsed={collapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          onToggle={toggleSidebar}
        />

        <div
          className={cn(
            "min-h-dvh min-w-0 transition-[padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            collapsed ? "lg:pl-[84px]" : "lg:pl-[292px]"
          )}
        >
          <AppTopbar
            collapsed={collapsed}
            onMobileMenuOpen={() => setMobileSidebarOpen(true)}
            onToggle={toggleSidebar}
          />

          <main className="motion-page mx-auto w-full max-w-[1800px] px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
            <div className="surface-elevated min-h-[calc(100dvh-88px)] min-w-0 rounded-2xl p-3 sm:p-4 lg:min-h-[calc(100dvh-112px)] lg:rounded-[28px] lg:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}

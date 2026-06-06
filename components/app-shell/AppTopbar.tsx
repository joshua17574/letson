// components/app-shell/AppTopbar.tsx
"use client";

import { signOut, useSession } from "next-auth/react";
import { Bell, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  onMobileMenu: () => void;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function AppTopbar({ collapsed, onToggle, onMobileMenu }: Props) {
  const { data: session } = useSession();
  const user = session?.user;
  const displayName = user?.name || user?.username || "User";
  const roleName = user?.roleName || user?.role || "Staff";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-3 sm:px-5 lg:px-6">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onMobileMenu}
          className="h-10 w-10 rounded-2xl lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onToggle}
          className="hidden h-10 w-10 rounded-2xl lg:inline-flex"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {getGreeting()}
          </p>
          <h1 className="truncate text-base font-black text-slate-950 sm:text-lg">
            Business command center
          </h1>
        </div>

        <div className="hidden min-w-[280px] max-w-md flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 md:flex">
          <Search className="mr-2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search pages, products, customers..."
            className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <Button
          type="button"
          size="icon"
          variant="outline"
          className="hidden h-10 w-10 rounded-2xl border-slate-200 bg-white md:inline-flex"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </Button>

        <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <UserCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="max-w-[150px] truncate text-sm font-bold text-slate-950">{displayName}</p>
            <p className="max-w-[150px] truncate text-xs text-slate-500">{roleName}</p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "h-10 rounded-2xl bg-rose-600 px-3 font-bold hover:bg-rose-700",
            "sm:px-4"
          )}
        >
          <LogOut className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}

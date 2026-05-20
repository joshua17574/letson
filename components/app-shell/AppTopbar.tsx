// components/app-shell/AppTopbar.tsx
"use client";

import { signOut, useSession } from "next-auth/react";
import {
  Bell,
  LogOut,
  Menu,
  Search,
  UserCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

export function AppTopbar({ collapsed, onToggle }: Props) {
  const { data: session } = useSession();

  return (
    <header
      className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl"
    >
      <div className="flex h-16 items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          {collapsed ? null : (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onToggle}
              className="rounded-xl lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <div className="hidden w-[420px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 lg:flex">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              placeholder="Search records, customers, receipts..."
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-xl text-slate-600"
          >
            <Bell className="h-5 w-5" />
          </Button>

          <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm md:flex">
            <UserCircle2 className="h-6 w-6 text-blue-600" />
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900">
                {session?.user?.name || "Profile"}
              </p>
              <p className="text-xs text-slate-500">
                {session?.user?.email || "Signed in"}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-xl bg-rose-600 hover:bg-rose-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
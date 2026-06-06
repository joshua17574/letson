// components/layout/Topbar.tsx
"use client";

import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { LogOut, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type LegacyTopbarUser = Session["user"] & {
  username?: string | null;
  roleName?: string | null;
  role?: string | null;
  position?: string | null;
};

export function Topbar({ user }: { user: LegacyTopbarUser }) {
  const displayName = user.name || user.username || "User";
  const subtitle = user.position || user.roleName || user.role || user.email || "Signed in";

  return (
    <header className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <UserCircle className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-500">Welcome back,</p>
          <h1 className="truncate text-xl font-black text-slate-950">{displayName}</h1>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      <Button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded-2xl bg-rose-600 hover:bg-rose-700"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </header>
  );
}

"use client";

import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { LogOut, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type TopbarUser = Session["user"] & {
  username?: string;
  roleName?: string;
  role?: string;
};

export function Topbar({ user }: { user: TopbarUser }) {
  const displayName = user.name || user.username || "User";
  const roleLabel = user.roleName || user.role || "Staff";

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm lg:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <UserCircle className="h-6 w-6" />
        </div>
        <div className="leading-tight">
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <p className="font-semibold text-slate-900">{displayName}</p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {roleLabel}
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </header>
  );
}

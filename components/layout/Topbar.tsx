// components/layout/Topbar.tsx
"use client";

import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { LogOut, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Topbar({ user }: { user: Session["user"] }) {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back,</p>
        <h1 className="text-xl font-bold text-slate-900">
          {user.name || user.username}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border bg-slate-50 px-3 py-2 sm:flex">
          <UserCircle className="h-6 w-6 text-blue-600" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.position}</p>
          </div>
        </div>

        <Button
          variant="destructive"
          onClick={() =>
            signOut({
              callbackUrl: "/login",
            })
          }
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
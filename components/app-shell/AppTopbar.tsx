// components/app-shell/AppTopbar.tsx
"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Bell, LogOut, Menu, Search, UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  collapsed: boolean;
  onMobileMenuOpen: () => void;
  onToggle: () => void;
};

export function AppTopbar({ onMobileMenuOpen }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const userName = session?.user?.name?.trim() || "Profile";
  const userEmail = session?.user?.email?.trim() || "Signed in";
  const [query, setQuery] = useState("");

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextQuery = query.trim();
    if (!nextQuery) return;

    const params = new URLSearchParams({
      q: nextQuery,
    });

    router.push(`/search?${params.toString()}`);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/86 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            type="button"
            aria-label="Open navigation"
            size="icon"
            variant="ghost"
            onClick={onMobileMenuOpen}
            className="rounded-xl lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <form
            className="surface-panel hidden w-[min(38vw,420px)] items-center gap-2 rounded-2xl px-3 xl:flex"
            onSubmit={submitSearch}
          >
            <Input
              type="search"
              aria-label="Search records"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              placeholder="Search records, customers, receipts..."
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              aria-label="Search records"
              className="size-8 shrink-0 rounded-xl text-primary/80 hover:text-primary"
              disabled={!query.trim()}
            >
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            aria-label="Notifications"
            size="icon"
            variant="ghost"
            className="rounded-xl text-muted-foreground hover:text-primary"
          >
            <Bell className="h-5 w-5" />
          </Button>

          <div
            className="hidden min-w-0 max-w-[220px] items-center gap-2 rounded-xl border border-border/80 bg-card/88 py-1.5 pr-3 pl-1.5 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--background)_72%,transparent),0_14px_34px_-28px_color-mix(in_oklch,var(--foreground)_52%,transparent)] md:flex xl:max-w-[260px]"
            aria-label={`Signed in as ${userName}`}
          >
            <div className="relative grid size-9 shrink-0 place-items-center rounded-[14px] bg-blue-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.26),0_10px_22px_-16px_rgb(37_99_235/0.72)]">
              <UserCircle2 className="h-5 w-5" aria-hidden="true" />
              <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[0.8rem] font-bold tracking-wide text-foreground">
                {userName}
              </p>
              <p className="truncate text-[0.7rem] font-medium text-muted-foreground">
                {userEmail}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            variant="outline"
            className="rounded-xl border-primary/20 text-primary hover:bg-accent/70 hover:text-accent-foreground"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

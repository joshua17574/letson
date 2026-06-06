// components/app-shell/ModuleHeader.tsx
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
  className?: string;
};

export function ModuleHeader({ title, description, actions, eyebrow, className }: Props) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="truncate text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

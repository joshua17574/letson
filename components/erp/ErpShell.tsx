"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ErpPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-5", className)}>{children}</div>;
}

export function ErpPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          {eyebrow ? (
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function ErpToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{children}</div>
    </div>
  );
}

export function ErpField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      {children}
    </div>
  );
}

export function ErpMetricCard({
  label,
  value,
  description,
  tone = "slate",
  icon,
}: {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  tone?: "slate" | "blue" | "emerald" | "amber" | "rose" | "violet";
  icon?: ReactNode;
}) {
  const tones = {
    slate: "from-slate-50 to-white text-slate-950 border-slate-200",
    blue: "from-blue-50 to-white text-blue-950 border-blue-100",
    emerald: "from-emerald-50 to-white text-emerald-950 border-emerald-100",
    amber: "from-amber-50 to-white text-amber-950 border-amber-100",
    rose: "from-rose-50 to-white text-rose-950 border-rose-100",
    violet: "from-violet-50 to-white text-violet-950 border-violet-100",
  } as const;

  return (
    <div className={cn("rounded-3xl border bg-gradient-to-br p-4 shadow-sm", tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
          <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
        </div>
        {icon ? (
          <div className="rounded-2xl bg-white/80 p-2 shadow-sm ring-1 ring-black/5">{icon}</div>
        ) : null}
      </div>
      {description ? <div className="mt-2 text-xs leading-5 opacity-70">{description}</div> : null}
    </div>
  );
}

export function ErpSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || description || actions) ? (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            {title ? <h2 className="text-base font-black text-slate-950">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

export function ErpEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
      <div className="text-sm font-black text-slate-900">{title}</div>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErpMobileCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>{children}</div>;
}

export function ErpKeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

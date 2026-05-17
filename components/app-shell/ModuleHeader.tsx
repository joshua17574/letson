// components/app-shell/ModuleHeader.tsx
import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function ModuleHeader({ title, description, actions }: Props) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">
          {title}
        </h1>

        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
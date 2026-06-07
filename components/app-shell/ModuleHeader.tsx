// components/app-shell/ModuleHeader.tsx
import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function ModuleHeader({ title, description, actions }: Props) {
  return (
    <div className="mb-4 flex min-w-0 flex-col justify-between gap-4 border-b border-border pb-4 sm:mb-6 sm:pb-5 lg:flex-row lg:items-center">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>

        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

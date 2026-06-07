"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      richColors
      position="top-right"
      toastOptions={{
        className:
          "rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_24px_70px_-42px_color-mix(in_oklch,var(--foreground)_58%,transparent)]",
      }}
    />
  );
}

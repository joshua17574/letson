// components/providers.tsx
"use client";

import dynamic from "next/dynamic";

const AppToaster = dynamic(
  () => import("./app-toaster").then((mod) => mod.AppToaster),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AppToaster />
    </>
  );
}

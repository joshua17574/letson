// components/layout/DashboardShell.tsx
import type { Session } from "next-auth";

// import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: Session["user"];
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* <Sidebar /> */}

      <div className="min-h-screen lg:pl-72">
        <Topbar user={user} />

        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
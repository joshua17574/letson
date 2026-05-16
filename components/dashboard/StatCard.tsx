// components/dashboard/StatCard.tsx
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn("border-0 text-white shadow-md", className)}>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-semibold opacity-90">{title}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
        </div>

        <Icon className="h-12 w-12 opacity-90" />
      </CardContent>
    </Card>
  );
}
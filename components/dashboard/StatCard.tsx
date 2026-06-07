// components/dashboard/StatCard.tsx
import type { LucideIcon } from "lucide-react";

import { AnimatedValue } from "@/components/motion/AnimatedValue";
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
    <Card className={cn("surface-panel border-0 shadow-md", className)}>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
          <p className="tabular-value mt-2 text-2xl font-black text-foreground">
            <AnimatedValue value={value} />
          </p>
        </div>

        <Icon className="h-12 w-12 text-muted-foreground/60" />
      </CardContent>
    </Card>
  );
}

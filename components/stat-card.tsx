import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

export function StatRow({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-right">
        <div className={cn("tabular text-ink", emphasize ? "text-2xl serif" : "text-base")}>{value}</div>
        {hint && <div className="text-[11px] text-muted mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

export function StatBar({ pct, color = "bg-accent" }: { pct: number; color?: string }) {
  const clamped = Math.max(0, Math.min(1.5, pct));
  return (
    <div className="h-1 w-full bg-rowHover rounded">
      <div
        className={cn("h-1 rounded", clamped > 1 ? "bg-bad" : color)}
        style={{ width: `${Math.min(clamped, 1) * 100}%` }}
      />
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/lib/calculations";

const map: Record<HealthStatus, { dot: string; bg: string; text: string }> = {
  ok: { dot: "bg-ok", bg: "bg-[rgba(45,106,79,0.08)]", text: "text-ok" },
  watch: { dot: "bg-warn", bg: "bg-[rgba(176,112,32,0.08)]", text: "text-warn" },
  bad: { dot: "bg-bad", bg: "bg-[rgba(176,48,32,0.08)]", text: "text-bad" },
};

export function StatusDot({ status }: { status: HealthStatus }) {
  return <span className={cn("inline-block w-2 h-2 rounded-full", map[status].dot)} />;
}

export function StatusBadge({ status, label }: { status: HealthStatus; label: string }) {
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded font-medium",
        m.bg,
        m.text,
      )}
    >
      <span className={cn("inline-block w-1.5 h-1.5 rounded-full", m.dot)} />
      {label}
    </span>
  );
}

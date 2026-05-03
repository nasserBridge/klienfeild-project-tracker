"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import type { AllDataRow, TransRow } from "@/lib/types";
import { staffPivot, uniqueTaskOptions } from "@/lib/calculations";
import { cn, fmtNum } from "@/lib/utils";

export function HoursByStaffTab({
  allData,
  trans,
}: {
  allData: AllDataRow[];
  trans: TransRow[];
}) {
  const [granularity, setGranularity] = React.useState<"week" | "month">("week");
  const [taskFilter, setTaskFilter] = React.useState<string>("__all");
  const tasks = React.useMemo(() => uniqueTaskOptions(allData), [allData]);
  const pivot = React.useMemo(
    () => staffPivot(trans, granularity, taskFilter === "__all" ? null : taskFilter),
    [trans, granularity, taskFilter],
  );

  if (pivot.rows.length === 0) {
    return (
      <div className="text-sm text-muted">
        {trans.length === 0
          ? "No transaction data — upload the K-Fasts Proj Trans Detail file to see hours by staff."
          : "No labor transactions match the selected task filter."}
      </div>
    );
  }

  const cellBg = (h: number) => {
    if (h <= 0) return "bg-transparent";
    const op = Math.min(0.32, 0.04 + (h / pivot.maxCell) * 0.28);
    return undefined;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex border border-line rounded">
          {(["week", "month"] as const).map((g) => (
            <button
              key={g}
              className={cn(
                "px-3 h-8 text-xs",
                granularity === g ? "bg-accent text-accent-fg" : "text-ink hover:bg-rowHover",
                g === "week" ? "rounded-l" : "rounded-r border-l border-line",
              )}
              onClick={() => setGranularity(g)}
            >
              {g === "week" ? "By Week" : "By Month"}
            </button>
          ))}
        </div>
        <select
          className="h-8 border border-line rounded px-2 text-xs bg-white"
          value={taskFilter}
          onChange={(e) => setTaskFilter(e.target.value)}
        >
          <option value="__all">All tasks</option>
          {tasks.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code} — {t.name}
            </option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-[rgba(15,15,14,0.02)] sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium border-b border-line">
                  Employee
                </th>
                {pivot.buckets.map((b) => (
                  <th
                    key={b}
                    className="text-right px-2 py-2 text-[11px] tabular text-muted font-medium border-b border-line whitespace-nowrap"
                  >
                    {labelForBucket(b, granularity)}
                  </th>
                ))}
                <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium border-b border-line">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((r) => (
                <tr key={r.employee} className="border-b border-line/60 hover:bg-rowHover">
                  <td className="px-3 py-1.5 truncate max-w-[220px]" title={r.employee}>
                    {r.employee}
                  </td>
                  {pivot.buckets.map((b) => {
                    const h = r.cells[b] ?? 0;
                    const op = h <= 0 ? 0 : Math.min(0.32, 0.04 + (h / Math.max(pivot.maxCell, 1)) * 0.28);
                    return (
                      <td
                        key={b}
                        className="text-right px-2 py-1.5 tabular text-[12px]"
                        style={op > 0 ? { background: `rgba(26,77,58,${op})` } : undefined}
                      >
                        {h > 0 ? fmtNum(h, 1) : ""}
                      </td>
                    );
                  })}
                  <td className="text-right px-3 py-1.5 tabular text-[12px] font-medium">
                    {fmtNum(r.total, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-white border-t border-lineStrong sticky bottom-0">
              <tr>
                <td className="px-3 py-2 text-[12px] font-medium">Total</td>
                {pivot.buckets.map((b) => (
                  <td key={b} className="text-right px-2 py-2 tabular text-[12px] font-medium">
                    {fmtNum(pivot.bucketTotals[b] ?? 0, 1)}
                  </td>
                ))}
                <td className="text-right px-3 py-2 tabular text-[12px] font-medium">
                  {fmtNum(pivot.grandTotal, 1)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

function labelForBucket(b: string, g: "week" | "month") {
  if (g === "week") {
    const d = new Date(b);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  // YYYY-MM
  const [y, m] = b.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

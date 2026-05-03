"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import type { TransRow } from "@/lib/types";
import { taskPivot } from "@/lib/calculations";
import { fmtNum } from "@/lib/utils";

export function HoursByTaskTab({ trans }: { trans: TransRow[] }) {
  const pivot = React.useMemo(() => taskPivot(trans), [trans]);

  if (pivot.rows.length === 0) {
    return <div className="text-sm text-muted">No labor transactions to show.</div>;
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-[rgba(15,15,14,0.02)] sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium border-b border-line whitespace-nowrap">
                Task
              </th>
              {pivot.employees.map((e) => (
                <th
                  key={e}
                  className="text-right px-2 py-2 text-[11px] tabular text-muted font-medium border-b border-line whitespace-nowrap"
                  title={e}
                >
                  {e.length > 18 ? e.slice(0, 18) + "…" : e}
                </th>
              ))}
              <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium border-b border-line">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {pivot.rows.map((r) => (
              <tr key={r.taskCode} className="border-b border-line/60 hover:bg-rowHover">
                <td className="px-3 py-1.5">
                  <span className="tabular text-[12px] mr-2">{r.taskCode}</span>
                  <span className="text-muted text-[12px] truncate" title={r.taskName}>
                    {r.taskName}
                  </span>
                </td>
                {pivot.employees.map((e) => {
                  const h = r.cells[e] ?? 0;
                  return (
                    <td key={e} className="text-right px-2 py-1.5 tabular text-[12px]">
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
              {pivot.employees.map((e) => (
                <td key={e} className="text-right px-2 py-2 tabular text-[12px] font-medium">
                  {fmtNum(pivot.empTotals[e] ?? 0, 1)}
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
  );
}

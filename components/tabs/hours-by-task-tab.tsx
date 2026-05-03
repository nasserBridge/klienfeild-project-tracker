"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import type { TransRow } from "@/lib/types";
import { taskPivot } from "@/lib/calculations";
import { fmtNum } from "@/lib/utils";

const EMP_COL_W = 72; // px — wide enough for "100.0", same for every employee column

export function HoursByTaskTab({ trans }: { trans: TransRow[] }) {
  const pivot = React.useMemo(() => taskPivot(trans), [trans]);

  if (pivot.rows.length === 0) {
    return (
      <div className="text-sm text-muted">
        {trans.length === 0
          ? "No transaction data — upload the K-Fasts Proj Trans Detail file to see hours by task."
          : "No labor transactions to show."}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
          <colgroup>
            {/* Task column: fixed width so long names don't blow up the table */}
            <col style={{ width: 300, minWidth: 300 }} />
            {pivot.employees.map((e) => (
              <col key={e} style={{ width: EMP_COL_W, minWidth: EMP_COL_W }} />
            ))}
            {/* Total */}
            <col style={{ width: EMP_COL_W, minWidth: EMP_COL_W }} />
          </colgroup>
          <thead className="bg-[rgba(15,15,14,0.02)] sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium border-b border-line">
                Task
              </th>
              {pivot.employees.map((e) => (
                <th
                  key={e}
                  className="text-right px-2 py-2 text-[11px] tabular text-muted font-medium border-b border-line overflow-hidden"
                  title={e}
                  style={{ width: EMP_COL_W }}
                >
                  <div className="truncate text-right" style={{ maxWidth: EMP_COL_W - 8 }}>
                    {e.length > 10 ? e.slice(0, 10) + "…" : e}
                  </div>
                </th>
              ))}
              <th
                className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium border-b border-line"
                style={{ width: EMP_COL_W }}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {pivot.rows.map((r) => (
              <tr key={r.taskCode} className="border-b border-line/60 hover:bg-rowHover">
                <td className="px-3 py-1.5 overflow-hidden">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="tabular text-[12px] shrink-0 font-medium">{r.taskCode}</span>
                    <span className="text-muted text-[12px] truncate min-w-0" title={r.taskName}>
                      {r.taskName}
                    </span>
                  </div>
                </td>
                {pivot.employees.map((e) => {
                  const h = r.cells[e] ?? 0;
                  return (
                    <td
                      key={e}
                      className="text-right px-2 py-1.5 tabular text-[12px]"
                      style={{ width: EMP_COL_W }}
                    >
                      {h > 0 ? fmtNum(h, 1) : ""}
                    </td>
                  );
                })}
                <td
                  className="text-right px-3 py-1.5 tabular text-[12px] font-medium"
                  style={{ width: EMP_COL_W }}
                >
                  {fmtNum(r.total, 1)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-white border-t border-lineStrong sticky bottom-0">
            <tr>
              <td className="px-3 py-2 text-[12px] font-medium">Total</td>
              {pivot.employees.map((e) => (
                <td
                  key={e}
                  className="text-right px-2 py-2 tabular text-[12px] font-medium"
                  style={{ width: EMP_COL_W }}
                >
                  {fmtNum(pivot.empTotals[e] ?? 0, 1)}
                </td>
              ))}
              <td
                className="text-right px-3 py-2 tabular text-[12px] font-medium"
                style={{ width: EMP_COL_W }}
              >
                {fmtNum(pivot.grandTotal, 1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

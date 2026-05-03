"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/status-badge";
import type { AllDataRow, TransRow } from "@/lib/types";
import { getProjectTotal, getTaskRows, groupTransByEmployee, transForTask } from "@/lib/calculations";
import { cn, fmtMoney, fmtNum, fmtPct } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { HealthStatus } from "@/lib/calculations";

type SortKey =
  | "taskCode"
  | "taskName"
  | "totalFee"
  | "netRev"
  | "remainingTotalFee"
  | "jtdHours"
  | "laborCost"
  | "pctRevenueTaken";

function statusFromPct(pct: number): HealthStatus {
  if (pct > 1) return "bad";
  if (pct >= 0.85) return "watch";
  return "ok";
}

export function TaskBudgetTab({
  allData,
  trans,
}: {
  allData: AllDataRow[];
  trans: TransRow[];
}) {
  const total = getProjectTotal(allData);
  const tasks = React.useMemo(() => getTaskRows(allData), [allData]);
  const [sortKey, setSortKey] = React.useState<SortKey>("taskCode");
  const [asc, setAsc] = React.useState(true);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const sorted = React.useMemo(() => {
    const out = [...tasks];
    out.sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * (asc ? 1 : -1);
      }
      return ((av as number) - (bv as number)) * (asc ? 1 : -1);
    });
    return out;
  }, [tasks, sortKey, asc]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) setAsc((v) => !v);
    else {
      setSortKey(k);
      setAsc(true);
    }
  };

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th
      onClick={() => onSort(k)}
      className={cn(
        "px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium cursor-pointer hover:text-ink select-none",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
      {sortKey === k && <span className="ml-1 text-[10px]">{asc ? "▲" : "▼"}</span>}
    </th>
  );

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-[rgba(15,15,14,0.02)] sticky top-0">
            <tr>
              <th className="w-6"></th>
              <Th k="taskCode">Code</Th>
              <Th k="taskName">Task</Th>
              <Th k="totalFee" right>Total Fee</Th>
              <Th k="netRev" right>JTD Revenue</Th>
              <Th k="remainingTotalFee" right>Remaining</Th>
              <Th k="jtdHours" right>JTD Hrs</Th>
              <Th k="laborCost" right>Labor Cost</Th>
              <Th k="pctRevenueTaken" right>% Rev Taken</Th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const isOpen = expanded === t.taskCode;
              const status = statusFromPct(t.pctRevenueTaken);
              return (
                <React.Fragment key={t.taskCode}>
                  <tr
                    className={cn(
                      "border-b border-line/70 cursor-pointer transition-colors hover:bg-rowHover",
                      isOpen && "bg-rowHover",
                    )}
                    onClick={() => setExpanded(isOpen ? null : t.taskCode)}
                  >
                    <td className="px-2">
                      <ChevronRight
                        size={12}
                        className={cn(
                          "text-muted transition-transform duration-150",
                          isOpen && "rotate-90",
                        )}
                      />
                    </td>
                    <td className="px-3 py-2 tabular text-[12px] text-ink">{t.taskCode}</td>
                    <td className="px-3 py-2 max-w-[320px] truncate" title={t.taskName}>
                      {t.taskName}
                    </td>
                    <td className="px-3 py-2 text-right tabular">{fmtMoney(t.totalFee)}</td>
                    <td className="px-3 py-2 text-right tabular">{fmtMoney(t.netRev)}</td>
                    <td className="px-3 py-2 text-right tabular">{fmtMoney(t.remainingTotalFee)}</td>
                    <td className="px-3 py-2 text-right tabular">{fmtNum(t.jtdHours, 1)}</td>
                    <td className="px-3 py-2 text-right tabular">{fmtMoney(t.laborCost)}</td>
                    <td className="px-3 py-2 text-right tabular">{fmtPct(t.pctRevenueTaken, 0)}</td>
                    <td className="px-2"><StatusDot status={status} /></td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-[rgba(15,15,14,0.015)] border-b border-line">
                      <td colSpan={10} className="px-6 py-4">
                        <ExpandedTaskDetail taskCode={t.taskCode!} trans={trans} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          {total && (
            <tfoot className="sticky bottom-0 bg-white border-t border-lineStrong">
              <tr>
                <td></td>
                <td className="px-3 py-2 tabular text-[12px] font-medium">Total</td>
                <td></td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtMoney(total.totalFee)}</td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtMoney(total.netRev)}</td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtMoney(total.remainingTotalFee)}</td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtNum(total.jtdHours, 1)}</td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtMoney(total.laborCost)}</td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtPct(total.pctRevenueTaken, 0)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}

function ExpandedTaskDetail({ taskCode, trans }: { taskCode: string; trans: TransRow[] }) {
  const taskTrans = transForTask(trans, taskCode).filter((t) => t.isLabor);
  const groups = groupTransByEmployee(taskTrans);
  if (groups.length === 0) {
    return <div className="text-xs text-muted">No labor transactions for this task.</div>;
  }
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.employee}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-sm text-ink">{g.employee}</div>
            <div className="text-xs text-muted">
              <span className="tabular">{fmtNum(g.totalHours, 1)}</span> hrs ·{" "}
              <span className="tabular">{fmtMoney(g.totalBill)}</span>
            </div>
          </div>
          <div className="border border-line rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[rgba(15,15,14,0.03)] text-muted">
                <tr>
                  <th className="px-3 py-1.5 text-left font-normal">Date</th>
                  <th className="px-3 py-1.5 text-left font-normal">Activity</th>
                  <th className="px-3 py-1.5 text-right font-normal">Hours</th>
                  <th className="px-3 py-1.5 text-right font-normal">Rate</th>
                  <th className="px-3 py-1.5 text-right font-normal">Bill Amt</th>
                  <th className="px-3 py-1.5 text-left font-normal">Description</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="px-3 py-1 tabular">{r.transDate.slice(0, 10)}</td>
                    <td className="px-3 py-1 truncate max-w-[160px]" title={r.activity ?? ""}>
                      {r.activity ?? "—"}
                    </td>
                    <td className="px-3 py-1 text-right tabular">{fmtNum(r.hrsQty, 2)}</td>
                    <td className="px-3 py-1 text-right tabular">{fmtMoney(r.rate, { cents: true })}</td>
                    <td className="px-3 py-1 text-right tabular">{fmtMoney(r.billAmt, { cents: true })}</td>
                    <td className="px-3 py-1 text-muted truncate max-w-[260px]" title={r.commentDesc ?? ""}>
                      {r.commentDesc ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/status-badge";
import type { AllDataRow, TransRow } from "@/lib/types";
import { getProjectTotal, getTaskRows, groupTransByEmployee, transForTask } from "@/lib/calculations";
import { cn, fmtMoney, fmtNum, fmtPct } from "@/lib/utils";
import { ChevronRight, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const [codeFilter, setCodeFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "ok" | "watch" | "bad">("all");

  const sorted = React.useMemo(() => {
    const q = codeFilter.trim().toLowerCase();
    const out = tasks.filter((t) => {
      if (q) {
        // taskName starts with the human task number, e.g. "1.1 Review…", "2.2 Seismic…"
        if (!t.taskName.toLowerCase().startsWith(q)) return false;
      }
      if (statusFilter !== "all") {
        const s = statusFromPct(t.pctRevenueTaken);
        if (s !== statusFilter) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * (asc ? 1 : -1);
      }
      return ((av as number) - (bv as number)) * (asc ? 1 : -1);
    });
    return out;
  }, [tasks, sortKey, asc, codeFilter, statusFilter]);

  // Totals computed from the filtered set (not the project-level rollup)
  const filteredTotal = React.useMemo(() => {
    const isFiltered = codeFilter.trim() !== "" || statusFilter !== "all";
    if (!isFiltered) return null; // use the project-level total row when unfiltered
    return sorted.reduce(
      (acc, t) => ({
        totalFee: acc.totalFee + t.totalFee,
        netRev: acc.netRev + t.netRev,
        remainingTotalFee: acc.remainingTotalFee + t.remainingTotalFee,
        jtdHours: acc.jtdHours + t.jtdHours,
        laborCost: acc.laborCost + t.laborCost,
        pctRevenueTaken: 0, // recalculate below
      }),
      { totalFee: 0, netRev: 0, remainingTotalFee: 0, jtdHours: 0, laborCost: 0, pctRevenueTaken: 0 },
    );
  }, [sorted, codeFilter, statusFilter]);

  const displayTotal = filteredTotal
    ? {
        ...filteredTotal,
        pctRevenueTaken:
          filteredTotal.totalFee > 0 ? filteredTotal.netRev / filteredTotal.totalFee : 0,
      }
    : total;

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

  const hasFilter = codeFilter.trim() !== "" || statusFilter !== "all";

  return (
    <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-[320px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
        <Input
          placeholder="Task number (e.g. 1, 1.1, 2.2)…"
          value={codeFilter}
          onChange={(e) => setCodeFilter(e.target.value)}
          className="pl-8 font-mono text-[13px]"
        />
        {codeFilter && (
          <button
            onClick={() => setCodeFilter("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div className="inline-flex border border-line rounded">
        {(["all", "ok", "watch", "bad"] as const).map((s, i) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 h-8 text-xs",
              i > 0 && "border-l border-line",
              i === 0 && "rounded-l",
              i === 3 && "rounded-r",
              statusFilter === s ? "bg-accent text-accent-fg" : "text-ink hover:bg-rowHover",
            )}
          >
            {s === "all" ? "All" : s === "ok" ? "On track" : s === "watch" ? "Watch" : "Over"}
          </button>
        ))}
      </div>
      {hasFilter && (
        <span className="text-xs text-muted">
          {sorted.length} of {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </span>
      )}
    </div>
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
          {displayTotal && (
            <tfoot className="sticky bottom-0 bg-white border-t border-lineStrong">
              <tr>
                <td></td>
                <td className="px-3 py-2 tabular text-[12px] font-medium">
                  {hasFilter ? "Subtotal" : "Total"}
                </td>
                <td></td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtMoney(displayTotal.totalFee)}</td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtMoney(displayTotal.netRev)}</td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtMoney(displayTotal.remainingTotalFee)}</td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtNum(displayTotal.jtdHours, 1)}</td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtMoney(displayTotal.laborCost)}</td>
                <td className="px-3 py-2 text-right tabular font-medium">{fmtPct(displayTotal.pctRevenueTaken, 0)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
    </div>
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

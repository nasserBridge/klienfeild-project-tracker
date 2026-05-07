"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import type { AllDataRow, ETCRow, StaffData, TransRow } from "@/lib/types";
import { cn, fmtMoney, fmtNum, fmtPct, round2 } from "@/lib/utils";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

export function ETCTab({
  projectId,
  rows,
  trans,
  allData,
  staff,
}: {
  projectId: string;
  rows: ETCRow[];
  trans: TransRow[];
  allData: AllDataRow[];
  staff: StaffData | null;
}) {
  const [sumTaskFilter, setSumTaskFilter] = React.useState("__all");

  const persist = React.useCallback(
    async (next: ETCRow[]) => {
      await db().etc.put({ projectId, rows: next.map(recalcEtc) });
    },
    [projectId],
  );

  const update = (i: number, patch: Partial<ETCRow>) => {
    persist(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  const remove = (i: number) => {
    if (!confirm("Remove this ETC row?")) return;
    persist(rows.filter((_, j) => j !== i));
  };
  const addRow = () => {
    persist([
      ...rows,
      {
        sumTask: "",
        filter: "",
        task: "",
        taskDescription: "",
        staff: "",
        discipline: "",
        type: "Labor",
        billingRate: 0,
        budgetHrs: 0,
        actualsHrs: 0,
        etcHrs: 0,
        pctSpent: 0,
        budgetCost: 0,
        actualCost: 0,
        etcCost: 0,
        eacCost: 0,
        vac: 0,
      },
    ]);
  };

  /**
   * Auto-populate ETC from K-Fasts: one row per (sub-task, employee) for
   * everyone who has logged labor hours. No cross-product — the rows reflect
   * exactly the people who appear in the source data. Budget Hrs is left at 0
   * for the PM to fill in (the actual budget lives in the master tracker ETC
   * sheet, which should be uploaded if it's available).
   */
  const autoPopulate = async () => {
    const subTasks = allData.filter((r) => !r.isTotalRow && !r.isSummaryTask && r.taskCode);
    const taskMap = new Map(subTasks.map((r) => [r.taskCode!, r]));

    // K-Fasts grouping: actual hrs/bill per (task, staff)
    const activityFreq = new Map<string, Map<string, number>>();
    const grouped = new Map<
      string,
      { staff: string; task: string; hrs: number; bill: number; sumTask: string; description: string }
    >();
    for (const t of trans) {
      if (!t.isLabor) continue;
      const key = `${t.wbs2}::${t.empVenUnitName}`;
      const tk = taskMap.get(t.wbs2);
      if (!grouped.has(key)) {
        grouped.set(key, {
          staff: t.empVenUnitName,
          task: t.wbs2,
          hrs: 0,
          bill: 0,
          sumTask: tk?.taskCode?.match(/^(\d{2})-/)?.[1] ?? "",
          description: tk?.taskName ?? t.taskName,
        });
      }
      const g = grouped.get(key)!;
      g.hrs += t.hrsQty;
      g.bill += t.billAmt;
      if (t.activity) {
        if (!activityFreq.has(key)) activityFreq.set(key, new Map());
        const f = activityFreq.get(key)!;
        f.set(t.activity, (f.get(t.activity) ?? 0) + t.hrsQty);
      }
    }
    const disciplineFor = (key: string): string => {
      const f = activityFreq.get(key);
      if (!f || f.size === 0) return "";
      const top = [...f.entries()].sort(([, a], [, b]) => b - a)[0][0];
      return top.replace(/^L-/i, "").trim();
    };

    const existingKey = new Set(rows.map((r) => `${r.task}::${r.staff}`));
    const staffByName = new Map((staff?.rows ?? []).map((s) => [s.name, s]));
    const additions: ETCRow[] = [];
    for (const [key, g] of grouped.entries()) {
      if (existingKey.has(key)) continue;
      const sObj = staffByName.get(g.staff);
      const billRate = g.hrs > 0 ? round2(g.bill / g.hrs) : 0;
      additions.push({
        sumTask: g.sumTask,
        filter: g.sumTask ? `${g.sumTask}-1` : "",
        task: g.task,
        taskDescription: g.description,
        staff: g.staff,
        discipline: disciplineFor(key) || sObj?.discipline || "",
        type: "Labor",
        billingRate: billRate,
        budgetHrs: 0, // PM enters manually — actuals are NOT a budget estimate
        actualsHrs: round2(g.hrs),
        etcHrs: 0,
        pctSpent: 0,
        budgetCost: 0,
        actualCost: round2(g.bill),
        etcCost: 0,
        eacCost: round2(g.bill),
        vac: 0,
      });
    }

    if (!additions.length) {
      alert("All K-Fasts (employee × task) combinations are already in the ETC list.");
      return;
    }
    persist([...rows, ...additions]);
  };

  const sumTaskOptions = [...new Set(rows.map((r) => r.sumTask).filter(Boolean))].sort();
  const filtered = sumTaskFilter === "__all" ? rows : rows.filter((r) => r.sumTask === sumTaskFilter);

  // Group by sub-task
  const groups = React.useMemo(() => {
    const m = new Map<string, ETCRow[]>();
    for (const r of filtered) {
      const k = r.task || "—";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <select className="h-8 border border-line rounded px-2 text-xs bg-white" value={sumTaskFilter} onChange={(e) => setSumTaskFilter(e.target.value)}>
          <option value="__all">All summary tasks</option>
          {sumTaskOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={autoPopulate} disabled={trans.length === 0 || allData.length === 0}>
            <RefreshCw size={13} /> Auto-populate from K-Fasts
          </Button>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus size={13} /> Add row
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted">
        {fmtNum(filtered.length)} of {fmtNum(rows.length)} rows
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgba(15,15,14,0.02)] sticky top-0">
              <tr>
                <Th>Task</Th>
                <Th>Description</Th>
                <Th>Staff</Th>
                <Th>Discipline</Th>
                <Th right>Bill Rate</Th>
                <Th right title="Enter manually — not available from PM Web or K-Fasts">Budget Hrs ✎</Th>
                <Th right>Actuals Hrs</Th>
                <Th right title="Enter manually — how many hours left to complete">ETC Hrs ✎</Th>
                <Th right>% Spent</Th>
                <Th right>Budget $</Th>
                <Th right>Actual $</Th>
                <Th right>ETC $</Th>
                <Th right>EAC $</Th>
                <Th right>VAC</Th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-3 py-6 text-center text-xs text-muted">
                    No ETC rows yet — click "Auto-populate from K-Fasts" to seed from actuals, then enter Budget Hrs.
                  </td>
                </tr>
              )}
              {groups.map(([taskCode, gRows]) => (
                <React.Fragment key={taskCode}>
                  <tr className="bg-[rgba(15,15,14,0.04)] border-b border-line">
                    <td colSpan={15} className="px-3 py-1 text-[12px] font-medium tabular">
                      {taskCode} · {gRows[0]?.taskDescription ?? ""}
                    </td>
                  </tr>
                  {gRows.map((r) => {
                    const i = rows.indexOf(r);
                    return (
                      <tr key={i} className="border-b border-line/60">
                        <Cell><Input value={r.task} onChange={(e) => update(i, { task: e.target.value })} className="h-7 text-[12px]" /></Cell>
                        <Cell><Input value={r.taskDescription} onChange={(e) => update(i, { taskDescription: e.target.value })} className="h-7 text-[12px]" /></Cell>
                        <Cell><Input value={r.staff} onChange={(e) => update(i, { staff: e.target.value })} className="h-7 text-[12px]" /></Cell>
                        <Cell><Input value={r.discipline} onChange={(e) => update(i, { discipline: e.target.value })} className="h-7 text-[12px]" /></Cell>
                        <CellNum value={r.billingRate} onChange={(v) => update(i, { billingRate: v })} step="0.01" />
                        <CellNum value={r.budgetHrs} onChange={(v) => update(i, { budgetHrs: v })} />
                        <td className="px-2 py-1 text-right tabular text-[12px] text-muted">{fmtNum(r.actualsHrs, 1)}</td>
                        <CellNum value={r.etcHrs} onChange={(v) => update(i, { etcHrs: v })} />
                        <td className="px-2 py-1 text-right tabular text-[12px] text-muted">{fmtPct(r.pctSpent, 0)}</td>
                        <td className="px-2 py-1 text-right tabular text-[12px] text-muted">{fmtMoney(r.budgetCost)}</td>
                        <td className="px-2 py-1 text-right tabular text-[12px] text-muted">{fmtMoney(r.actualCost, { cents: true })}</td>
                        <td className="px-2 py-1 text-right tabular text-[12px] text-muted">{fmtMoney(r.etcCost)}</td>
                        <td className="px-2 py-1 text-right tabular text-[12px] text-muted">{fmtMoney(r.eacCost, { cents: true })}</td>
                        <td className={cn("px-2 py-1 text-right tabular text-[12px]", r.vac < 0 && "text-bad")}>{fmtMoney(r.vac)}</td>
                        <td className="px-2 py-1">
                          <button onClick={() => remove(i)} className="text-muted hover:text-bad p-1 rounded">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-[11px] text-muted space-y-0.5">
        <div>Auto-populated from K-Fasts: Discipline · Actual Hrs · Actual $ · Billing Rate</div>
        <div>Enter manually: Budget Hrs ✎ · ETC Hrs ✎</div>
        <div>Auto-computed: Budget $ · ETC $ · EAC $ · VAC · % Spent</div>
      </div>
    </div>
  );
}

/** Recompute derived numeric columns when any input changes. All values rounded to 2 decimals. */
function recalcEtc(r: ETCRow): ETCRow {
  const budgetCost = round2(r.billingRate * r.budgetHrs);
  const etcCost = round2(r.billingRate * r.etcHrs);
  const eacCost = round2(r.actualCost + etcCost);
  const vac = round2(budgetCost - eacCost);
  const pctSpent = r.budgetHrs > 0 ? Math.round((r.actualsHrs / r.budgetHrs) * 10000) / 10000 : 0;
  return {
    ...r,
    billingRate: round2(r.billingRate),
    budgetHrs: round2(r.budgetHrs),
    actualsHrs: round2(r.actualsHrs),
    etcHrs: round2(r.etcHrs),
    actualCost: round2(r.actualCost),
    budgetCost,
    etcCost,
    eacCost,
    vac,
    pctSpent,
  };
}

function Th({ children, right, title }: { children: React.ReactNode; right?: boolean; title?: string }) {
  return (
    <th
      title={title}
      className={
        "px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium whitespace-nowrap " +
        (right ? "text-right" : "text-left")
      }
    >
      {children}
    </th>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1">{children}</td>;
}

function CellNum({
  value,
  onChange,
  step = "1",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <td className="px-2 py-1">
      <Input
        type="number"
        step={step}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-7 text-[12px] text-right tabular"
      />
    </td>
  );
}

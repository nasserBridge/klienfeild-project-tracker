import type { AllDataRow, TransRow } from "./types";
import { daysBetween, monthKey, weekStartingMonday } from "./utils";

export type HealthStatus = "ok" | "watch" | "bad";

export type Health = {
  status: HealthStatus;
  label: string;
  reason: string;
  pctSpent: number;
  pctTimeElapsed: number | null;
  multiplierVsTarget: number | null;
};

export function getProjectTotal(rows: AllDataRow[]): AllDataRow | undefined {
  return rows.find((r) => r.isTotalRow);
}

export function getTaskRows(rows: AllDataRow[]): AllDataRow[] {
  return rows.filter((r) => !r.isTotalRow && !r.isSummaryTask && r.taskCode);
}

export function computeHealth(total: AllDataRow): Health {
  const pctSpent = total.totalFee > 0 ? total.netRev / total.totalFee : 0;
  let pctTimeElapsed: number | null = null;
  if (total.startDate && total.estCompDate) {
    const totalDays = daysBetween(total.startDate, total.estCompDate);
    const elapsed = daysBetween(total.startDate, new Date().toISOString());
    if (totalDays && totalDays > 0 && elapsed !== null) {
      pctTimeElapsed = Math.max(0, Math.min(1, elapsed / totalDays));
    }
  }
  const multVsTarget =
    total.targetMultiplierJtd && total.multiplierJtd
      ? total.multiplierJtd / total.targetMultiplierJtd
      : null;

  const overBudget = total.remainingTotalFee < 0 || pctSpent > 1;
  const multBreached = multVsTarget !== null && multVsTarget < 1;
  const spentBreached = pctTimeElapsed !== null && pctSpent > pctTimeElapsed;

  let status: HealthStatus = "ok";
  let label = "On track";
  let reason = "";

  const pctSpentTxt = `${(pctSpent * 100).toFixed(0)}%`;
  const pctTimeTxt = pctTimeElapsed === null ? null : `${(pctTimeElapsed * 100).toFixed(0)}%`;
  const multTxt = multVsTarget === null ? null : `${(multVsTarget * 100).toFixed(0)}%`;

  if (overBudget && (multBreached || spentBreached)) {
    status = "bad";
    label = total.remainingTotalFee < 0 ? "Over budget" : "Underwater";
    reason = total.remainingTotalFee < 0
      ? `Remaining fee is negative — you're ${pctSpentTxt} into the budget.`
      : `Spent ${pctSpentTxt} of fee${pctTimeTxt ? ` against ${pctTimeTxt} of schedule` : ""}${multTxt ? `; multiplier at ${multTxt} of target` : ""}.`;
  } else if (multBreached || spentBreached) {
    status = "watch";
    label = "Watch";
    if (spentBreached && pctTimeTxt) {
      reason = `You've used ${pctSpentTxt} of the budget but are only ${pctTimeTxt} of the way through the schedule.`;
    } else if (multBreached) {
      reason = `Multiplier (JTD) is at ${multTxt} of target.`;
    } else {
      reason = "One pacing metric is breached.";
    }
  } else {
    status = "ok";
    label = "On track";
    reason = pctTimeTxt
      ? `Spent ${pctSpentTxt} against ${pctTimeTxt} of schedule${multTxt ? `; multiplier at ${multTxt} of target` : ""}.`
      : `Spent ${pctSpentTxt} of total fee${multTxt ? `; multiplier at ${multTxt} of target` : ""}.`;
  }

  return {
    status,
    label,
    reason,
    pctSpent,
    pctTimeElapsed,
    multiplierVsTarget: multVsTarget,
  };
}

/** Cumulative hours over time. Returns sorted array of {date, hours, cumulative}. */
export function cumulativeHours(trans: TransRow[]): { date: string; hours: number; cumulative: number }[] {
  const labor = trans.filter((t) => t.isLabor);
  const byDay = new Map<string, number>();
  for (const t of labor) {
    const d = t.transDate.slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + t.hrsQty);
  }
  const sorted = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  let cum = 0;
  return sorted.map(([date, hours]) => {
    cum += hours;
    return { date, hours, cumulative: Math.round(cum * 100) / 100 };
  });
}

export type StaffPivotCell = { hours: number };
export type StaffPivot = {
  buckets: string[]; // e.g. week-starting dates or YYYY-MM
  rows: { employee: string; cells: Record<string, number>; total: number }[];
  bucketTotals: Record<string, number>;
  grandTotal: number;
  maxCell: number;
};

export function staffPivot(
  trans: TransRow[],
  granularity: "week" | "month",
  taskFilter?: string | null,
): StaffPivot {
  const labor = trans.filter((t) => t.isLabor && (!taskFilter || t.wbs2 === taskFilter));
  const bucketKey = (iso: string) =>
    granularity === "week" ? weekStartingMonday(iso) : monthKey(iso);

  const buckets = new Set<string>();
  const rowMap = new Map<string, Record<string, number>>();
  const employeeTotals = new Map<string, number>();
  const bucketTotals: Record<string, number> = {};

  for (const t of labor) {
    const b = bucketKey(t.transDate);
    buckets.add(b);
    if (!rowMap.has(t.empVenUnitName)) rowMap.set(t.empVenUnitName, {});
    const row = rowMap.get(t.empVenUnitName)!;
    row[b] = (row[b] ?? 0) + t.hrsQty;
    employeeTotals.set(t.empVenUnitName, (employeeTotals.get(t.empVenUnitName) ?? 0) + t.hrsQty);
    bucketTotals[b] = (bucketTotals[b] ?? 0) + t.hrsQty;
  }

  const sortedBuckets = [...buckets].sort();
  const rows = [...rowMap.entries()]
    .map(([employee, cells]) => ({
      employee,
      cells,
      total: employeeTotals.get(employee) ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  let max = 0;
  for (const r of rows) for (const k of sortedBuckets) max = Math.max(max, r.cells[k] ?? 0);

  const grand = [...employeeTotals.values()].reduce((a, b) => a + b, 0);

  return { buckets: sortedBuckets, rows, bucketTotals, grandTotal: grand, maxCell: max };
}

export type TaskPivot = {
  employees: string[];
  rows: { taskCode: string; taskName: string; cells: Record<string, number>; total: number }[];
  empTotals: Record<string, number>;
  grandTotal: number;
};

export function taskPivot(trans: TransRow[]): TaskPivot {
  const labor = trans.filter((t) => t.isLabor);
  const employees = new Set<string>();
  const taskMap = new Map<string, { taskName: string; cells: Record<string, number>; total: number }>();
  const empTotals: Record<string, number> = {};
  let grand = 0;

  for (const t of labor) {
    employees.add(t.empVenUnitName);
    if (!taskMap.has(t.wbs2)) {
      taskMap.set(t.wbs2, { taskName: t.taskName, cells: {}, total: 0 });
    }
    const r = taskMap.get(t.wbs2)!;
    r.cells[t.empVenUnitName] = (r.cells[t.empVenUnitName] ?? 0) + t.hrsQty;
    r.total += t.hrsQty;
    empTotals[t.empVenUnitName] = (empTotals[t.empVenUnitName] ?? 0) + t.hrsQty;
    grand += t.hrsQty;
  }

  const sortedEmployees = [...employees].sort((a, b) => (empTotals[b] ?? 0) - (empTotals[a] ?? 0));
  const rows = [...taskMap.entries()]
    .map(([taskCode, v]) => ({ taskCode, ...v }))
    .sort((a, b) => a.taskCode.localeCompare(b.taskCode));

  return { employees: sortedEmployees, rows, empTotals, grandTotal: grand };
}

export type RevenueByPeriod = {
  rows: { period: string; revenue: number; cumulative: number }[];
  total: number;
};

export function revenueByPeriod(trans: TransRow[]): RevenueByPeriod {
  const map = new Map<string, number>();
  for (const t of trans) {
    if (!t.period) continue;
    map.set(t.period, (map.get(t.period) ?? 0) + t.billAmt);
  }
  const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  let cum = 0;
  const rows = sorted.map(([period, revenue]) => {
    cum += revenue;
    return { period, revenue, cumulative: cum };
  });
  return { rows, total: cum };
}

export function uniqueTaskOptions(rows: AllDataRow[]): { code: string; name: string }[] {
  return getTaskRows(rows).map((r) => ({ code: r.taskCode!, name: r.taskName }));
}

export function transForTask(trans: TransRow[], taskCode: string): TransRow[] {
  return trans.filter((t) => t.wbs2 === taskCode);
}

export function groupTransByEmployee(trans: TransRow[]): { employee: string; rows: TransRow[]; totalHours: number; totalBill: number }[] {
  const map = new Map<string, TransRow[]>();
  for (const t of trans) {
    if (!map.has(t.empVenUnitName)) map.set(t.empVenUnitName, []);
    map.get(t.empVenUnitName)!.push(t);
  }
  return [...map.entries()]
    .map(([employee, rows]) => ({
      employee,
      rows: rows.sort((a, b) => a.transDate.localeCompare(b.transDate)),
      totalHours: rows.reduce((s, r) => s + r.hrsQty, 0),
      totalBill: rows.reduce((s, r) => s + r.billAmt, 0),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}

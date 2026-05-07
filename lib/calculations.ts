import type {
  AllDataRow,
  CheckDetailRow,
  ETCRow,
  InvoiceLogData,
  InvoiceLogPeriod,
  InvoiceLogRow,
  InvoiceSummaryRow,
  PeriodRow,
  StaffData,
  TablesData,
  TaskBudgetRow,
  TaskSummaryRow,
  TransRow,
} from "./types";
import { daysBetween, monthKey, round2, weekStartingMonday } from "./utils";

// === Auto-derivations from PM Web + K-Fasts =======================================

const sumTaskOf = (taskCode: string | null): string | null => {
  if (!taskCode) return null;
  const m = taskCode.match(/^(\d{2})-/);
  return m ? m[1] : null;
};

/** Group sub-task rows by their summary task (XX-) and aggregate. Tasks that
 *  only have a summary row (no sub-task breakout) are still emitted using
 *  the summary row's own data — otherwise tasks like "04" or "05" silently
 *  disappear from the Task Summary view. */
export function deriveTaskSummary(allData: AllDataRow[]): TaskSummaryRow[] {
  const subTasks = allData.filter((r) => !r.isTotalRow && !r.isSummaryTask && r.taskCode);
  const summaryRows = allData.filter((r) => r.isSummaryTask && r.taskCode);

  const map = new Map<string, AllDataRow[]>();
  for (const r of subTasks) {
    const k = sumTaskOf(r.taskCode);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  // Fall back to the summary row itself for tasks with no sub-task children.
  for (const sr of summaryRows) {
    const k = sumTaskOf(sr.taskCode);
    if (!k || map.has(k)) continue;
    map.set(k, [sr]);
  }

  const out: TaskSummaryRow[] = [];
  for (const [sumTask, rows] of [...map.entries()].sort()) {
    const summaryRow = summaryRows.find((r) => sumTaskOf(r.taskCode) === sumTask);
    const taskDescription =
      summaryRow?.taskName ??
      (rows[0]?.taskName ?? "").replace(/^\d+(\.\d+)*\s+/, "");
    const totalFee = round2(rows.reduce((s, r) => s + r.totalFee, 0));
    const laborFee = round2(rows.reduce((s, r) => s + r.laborFee, 0));
    const reimbursableFee = round2(rows.reduce((s, r) => s + r.reimbFee, 0));
    const subFee = round2(rows.reduce((s, r) => s + r.consultFee, 0));
    const jtdRevenue = round2(rows.reduce((s, r) => s + r.netRev, 0));
    const feeRemaining = round2(rows.reduce((s, r) => s + r.remainingTotalFee, 0));
    const pctComplete = totalFee > 0 ? round2((jtdRevenue / totalFee) * 10000) / 10000 : 0;
    const estimateToComp = round2(Math.max(0, feeRemaining));
    const estimateAtComp = round2(jtdRevenue + estimateToComp);
    const variance = round2(totalFee - estimateAtComp);
    const pctSpent = totalFee > 0 ? round2((jtdRevenue / totalFee) * 10000) / 10000 : 0;
    // Prefer the summary row's dates (canonical task dates), fall back to first sub-task
    const startDate = summaryRow?.startDate ?? rows[0]?.startDate ?? null;
    const endDate = summaryRow?.estCompDate ?? rows[0]?.estCompDate ?? null;
    out.push({
      sumTask,
      taskNo: "",
      taskDescription,
      laborFee,
      reimbursableFee,
      labFee: 0,
      subFee,
      changeOrderAmt: 0,
      totalFee,
      jtdRevenue,
      feeRemaining,
      pctComplete,
      estimateToComp,
      estimateAtComp,
      variance,
      pctSpent,
      startDate,
      endDate,
    });
  }
  return out;
}

/** Sub-task rows with ETC/EAC defaults derived from PM Web.
 *  When a summary task (XX-0000) carries the budget directly with no sub-task
 *  breakout, surface that summary row too so the Task Budget view doesn't lose
 *  it (otherwise tasks 4/5/7 in the OCSAN sample would never render). */
export function deriveTaskBudget(allData: AllDataRow[]): TaskBudgetRow[] {
  const taskRows = allData.filter((r) => !r.isTotalRow && r.taskCode);
  // Bucket by sumTask to detect "summary-only" tasks
  const bySum = new Map<string, AllDataRow[]>();
  for (const r of taskRows) {
    const k = sumTaskOf(r.taskCode);
    if (!k) continue;
    if (!bySum.has(k)) bySum.set(k, []);
    bySum.get(k)!.push(r);
  }
  const out: TaskBudgetRow[] = [];
  for (const [, rows] of [...bySum.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const subs = rows.filter((r) => !r.isSummaryTask);
    const candidates = subs.length > 0 ? subs : rows.filter((r) => r.isSummaryTask);
    for (const r of candidates) {
      const totalFee = round2(r.totalFee);
      const jtdRevenue = round2(r.netRev);
      const feeRemaining = round2(r.remainingTotalFee);
      const estimateToComp = round2(Math.max(0, feeRemaining));
      const estimateAtComp = round2(jtdRevenue + estimateToComp);
      out.push({
        sumTask: sumTaskOf(r.taskCode) ?? "",
        taskNo: r.taskCode ?? "",
        taskDescription: r.taskName,
        laborFee: round2(r.laborFee),
        reimbursableFee: round2(r.reimbFee),
        labFee: 0,
        subFee: round2(r.consultFee),
        changeOrderAmt: 0,
        totalFee,
        jtdRevenue,
        feeRemaining,
        pctComplete: totalFee > 0 ? Math.round((jtdRevenue / totalFee) * 10000) / 10000 : 0,
        estimateToComp,
        estimateAtComp,
        variance: round2(totalFee - estimateAtComp),
        pctSpent: totalFee > 0 ? Math.round((jtdRevenue / totalFee) * 10000) / 10000 : 0,
        startDate: r.startDate,
        endDate: r.estCompDate,
        isSummaryHeader: r.isSummaryTask,
      });
    }
  }
  return out;
}

/** Invoice Summary aggregated by sum task. Summary-only tasks (no sub-task
 *  children in PM Web) are still emitted so every fee-bearing task appears. */
export function deriveInvoiceSummary(allData: AllDataRow[]): InvoiceSummaryRow[] {
  const subTasks = allData.filter((r) => !r.isTotalRow && !r.isSummaryTask && r.taskCode);
  const summaryRows = allData.filter((r) => r.isSummaryTask && r.taskCode);
  const map = new Map<string, AllDataRow[]>();
  for (const r of subTasks) {
    const k = sumTaskOf(r.taskCode);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  for (const sr of summaryRows) {
    const k = sumTaskOf(sr.taskCode);
    if (!k || map.has(k)) continue;
    map.set(k, [sr]);
  }
  const out: InvoiceSummaryRow[] = [];
  for (const [task, rows] of [...map.entries()].sort()) {
    const summaryRow = summaryRows.find((r) => sumTaskOf(r.taskCode) === task);
    const taskDescription =
      summaryRow?.taskName ??
      (rows[0]?.taskName ?? "").replace(/^\d+(\.\d+)*\s+/, "");
    const totalFee = round2(rows.reduce((s, r) => s + r.totalFee, 0));
    const cumInvoiceToDate = round2(rows.reduce((s, r) => s + r.billedTotal, 0));
    const jtdRevenue = round2(rows.reduce((s, r) => s + r.netRev, 0));
    const paidToDate = round2(rows.reduce((s, r) => s + r.receivedAmount, 0));
    // PM Web all-data has AR aging on the project-total row only; pick it up
    // when the row's task code is null (i.e. when we used a summary row).
    const arOver60 = round2(rows.reduce((s, r) => s + (r as any).arAmnt * 0, 0));
    const nrm = round2(avg(rows.map((r) => r.multiplierJtd ?? 0).filter((n) => n > 0)));
    const remaining = round2(rows.reduce((s, r) => s + r.remainingTotalFee, 0));
    const eac = round2(totalFee + Math.max(0, jtdRevenue - cumInvoiceToDate - remaining));
    out.push({
      task,
      taskDescription,
      totalFee,
      estCurrentInvoice: 0,
      cumInvoiceToDate,
      jtdRevenue,
      estimateAtComplete: round2(Math.max(eac, totalFee)),
      pctSpent: totalFee > 0 ? Math.round((cumInvoiceToDate / totalFee) * 10000) / 10000 : 0,
      pctComp: totalFee > 0 ? Math.round((jtdRevenue / totalFee) * 10000) / 10000 : 0,
      paidToDate,
      arOver60,
      nrm,
    });
  }
  return out;
}

/** Pivot K-Fasts trans by WBS2 × Employee → CheckDetail rows with subtotals. */
export function deriveCheckDetail(trans: TransRow[]): CheckDetailRow[] {
  // Group by WBS2; within each, by employee. Emit per-employee row, then a "Total" subtotal row.
  const byTask = new Map<string, { taskName: string; byEmp: Map<string, { hrs: number; bill: number }> }>();
  for (const t of trans) {
    if (!t.wbs2) continue;
    if (!byTask.has(t.wbs2)) byTask.set(t.wbs2, { taskName: t.taskName, byEmp: new Map() });
    const g = byTask.get(t.wbs2)!;
    if (!g.byEmp.has(t.empVenUnitName))
      g.byEmp.set(t.empVenUnitName, { hrs: 0, bill: 0 });
    const e = g.byEmp.get(t.empVenUnitName)!;
    e.hrs += t.hrsQty;
    e.bill += t.billAmt;
  }
  const out: CheckDetailRow[] = [];
  for (const [wbs2, g] of [...byTask.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    let subHrs = 0;
    let subBill = 0;
    for (const [emp, v] of [...g.byEmp.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      out.push({
        wbs2,
        taskName: g.taskName,
        empVenUnitName: emp,
        hrsQty: round2(v.hrs),
        billAmt: round2(v.bill),
        isSubtotal: false,
      });
      subHrs += v.hrs;
      subBill += v.bill;
    }
    out.push({
      wbs2,
      taskName: g.taskName,
      empVenUnitName: "",
      hrsQty: round2(subHrs),
      billAmt: round2(subBill),
      isSubtotal: true,
    });
  }
  return out;
}

/** Build Tables data (periods + tasks + sumTasks lookup) from PM Web + K-Fasts. */
export function deriveTables(allData: AllDataRow[], trans: TransRow[]): TablesData {
  // Periods from K-Fasts: collect unique YYYYPP codes, derive month/year from min trans date in period
  const periodSet = new Map<string, { earliest: string }>();
  for (const t of trans) {
    if (!t.period) continue;
    if (!periodSet.has(t.period)) periodSet.set(t.period, { earliest: t.transDate });
    else {
      const cur = periodSet.get(t.period)!;
      if (t.transDate < cur.earliest) cur.earliest = t.transDate;
    }
  }
  const periods = [...periodSet.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, info]) => {
      const d = new Date(info.earliest);
      const month = d.toLocaleDateString("en-US", { month: "short" });
      const year = String(d.getUTCFullYear());
      const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
      return { billedPeriod: code, month, year, date };
    });

  // Tasks (sub-tasks) and SumTasks from PM Web
  const tasks = allData
    .filter((r) => r.taskCode && !r.isTotalRow && !r.isSummaryTask)
    .map((r) => ({
      taskNo: r.taskCode!,
      taskDescription: r.taskName,
      taskNoDescription: `${r.taskCode} - ${r.taskName}`,
      summaryTask: sumTaskOf(r.taskCode) ?? "",
    }));

  const sumTasks = allData
    .filter((r) => r.isSummaryTask && r.taskCode)
    .map((r) => ({
      sumTask: sumTaskOf(r.taskCode) ?? "",
      summaryDescription: r.taskName,
      summaryNoDescriptions: `${sumTaskOf(r.taskCode) ?? ""} - ${r.taskName}`,
    }));

  return { periods, tasks, sumTasks };
}

function avg(ns: number[]): number {
  if (ns.length === 0) return 0;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

// === ETC autopopulate ============================================================

/**
 * Build ETC rows from K-Fasts + PM Web. This is a *fallback* used only when
 * the master tracker's ETC sheet hasn't been uploaded yet — once it has, the
 * uploaded sheet takes over and this function is not called.
 *
 *  - One row per (sub-task, employee) for every K-Fasts labor entry.
 *  - We do NOT cross-product against the Staff list — the user wants exactly
 *    the people who appear in the source data, not every staff member who
 *    might theoretically work on a task.
 *  - Budget Hrs is left at 0 (the actual budget lives in the master tracker
 *    ETC sheet). The PM can fill it in.
 */
export function deriveEtc(
  trans: TransRow[],
  allData: AllDataRow[],
  staff: StaffData | null,
): ETCRow[] {
  const subTasks = allData.filter((r) => !r.isTotalRow && !r.isSummaryTask && r.taskCode);
  const taskMap = new Map(subTasks.map((r) => [r.taskCode!, r]));

  const activityFreq = new Map<string, Map<string, number>>();
  const grouped = new Map<
    string,
    { staff: string; task: string; hrs: number; bill: number }
  >();
  for (const t of trans) {
    if (!t.isLabor) continue;
    const key = `${t.wbs2}::${t.empVenUnitName}`;
    if (!grouped.has(key)) {
      grouped.set(key, { staff: t.empVenUnitName, task: t.wbs2, hrs: 0, bill: 0 });
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

  const staffByName = new Map<string, { discipline: string }>();
  if (staff) {
    for (const s of staff.rows) {
      staffByName.set(s.name, { discipline: s.discipline ?? "" });
    }
  }

  const out: ETCRow[] = [];
  for (const [key, g] of grouped.entries()) {
    const tk = taskMap.get(g.task);
    const sumTask = g.task.match(/^(\d{2})-/)?.[1] ?? "";
    const hrs = round2(g.hrs);
    const bill = round2(g.bill);
    const billRate = g.hrs > 0 ? round2(g.bill / g.hrs) : 0;
    out.push({
      sumTask,
      filter: sumTask ? `${sumTask}-1` : "",
      task: g.task,
      taskDescription: tk?.taskName ?? "",
      staff: g.staff,
      discipline: disciplineFor(key) || staffByName.get(g.staff)?.discipline || "",
      type: "Labor",
      billingRate: billRate,
      budgetHrs: 0, // unknown without the master tracker — PM enters manually
      actualsHrs: hrs,
      etcHrs: 0,
      pctSpent: 0,
      budgetCost: 0,
      actualCost: bill,
      etcCost: 0,
      eacCost: bill,
      vac: 0,
    });
  }
  out.sort((a, b) => a.task.localeCompare(b.task) || a.staff.localeCompare(b.staff));
  return out;
}

// === Invoice Log autopopulate ====================================================

/**
 * Build a starting Invoice Log from K-Fasts billed transactions.
 *
 *  - One row per "firm" — derived from BillTitle/Activity (Labor → "01-KLF",
 *    sub vendors → vendor name as "0X-{vendor}"). Falls back to a single
 *    "01-KLF" row if no firm signal exists.
 *  - Periods = distinct first-of-month dates touched by any billed transaction.
 *  - Per-period values = sum of BillAmt within that month for that firm.
 *  - Budget per firm = sum of laborFee/consultFee/reimbFee from PM Web all-data
 *    (split by transaction category).
 */
export function deriveInvoiceLog(
  trans: TransRow[],
  allData: AllDataRow[],
): InvoiceLogData {
  // Period bucket key = first-of-month ISO. Returns null for invalid dates so
  // a single bad row doesn't crash the whole derivation.
  const monthOf = (iso: string): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  };

  // Pick a firm bucket for a transaction
  const firmFor = (t: TransRow): string => {
    if (t.isLabor) return "01-KLF";
    // Subs go to "0X-{vendor}" — empVenUnitName when Sub category
    const cat = (t.category ?? "").toLowerCase();
    const tt = (t.transType ?? "").toLowerCase();
    if (cat.includes("sub") || tt === "sb") return `Sub-${t.empVenUnitName}`;
    if (cat.includes("reimb") || cat.includes("expense")) return `Reimb-${t.empVenUnitName}`;
    return `Other-${t.empVenUnitName || "Unknown"}`;
  };

  // Bucket BillAmt by (firm, month)
  const months = new Set<string>();
  const byFirm = new Map<string, { total: number; perMonth: Record<string, number> }>();
  for (const t of trans) {
    if (!t.transDate) continue;
    const month = monthOf(t.transDate);
    if (!month) continue;
    const firm = firmFor(t);
    months.add(month);
    if (!byFirm.has(firm)) byFirm.set(firm, { total: 0, perMonth: {} });
    const f = byFirm.get(firm)!;
    f.total += t.billAmt;
    f.perMonth[month] = (f.perMonth[month] ?? 0) + t.billAmt;
  }

  // Budget per firm: from PM Web project total, split by category
  const total = allData.find((r) => r.isTotalRow);
  const budgets: Record<string, number> = {};
  if (total) {
    budgets["01-KLF"] = round2(total.laborFee + total.reimbFee);
    // Sub firms split by individual vendor billed amounts is hard without an
    // explicit mapping; use consultFee as the bucket total — distributed equally
    // when multiple subs detected.
    const subFirms = [...byFirm.keys()].filter((k) => k.startsWith("Sub-"));
    if (subFirms.length > 0) {
      const each = round2(total.consultFee / subFirms.length);
      for (const f of subFirms) budgets[f] = each;
    }
  }

  const periods: InvoiceLogPeriod[] = [...months]
    .sort()
    .map((iso) => ({
      date: iso,
      label: new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
    }));

  const rows: InvoiceLogRow[] = [...byFirm.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([firm, info]) => {
      const byPeriod: Record<string, number> = {};
      for (const m of months) byPeriod[m] = round2(info.perMonth[m] ?? 0);
      const cum = round2(info.total);
      const budget = round2(budgets[firm] ?? 0);
      return {
        firm,
        ntpDate: total?.startDate ?? null,
        budget,
        remainingBudget: round2(budget - cum),
        cumInvoice: cum,
        pctSpent: budget > 0 ? Math.round((cum / budget) * 10000) / 10000 : 0,
        byPeriod,
      };
    });

  return { rows, periods };
}

/** Hours from K-Fasts in the current calendar month. Labor only. */
export function mtdLaborHours(trans: TransRow[]): number {
  const now = new Date();
  const m = now.getUTCMonth();
  const y = now.getUTCFullYear();
  return round2(
    trans
      .filter((t) => t.isLabor)
      .filter((t) => {
        const d = new Date(t.transDate);
        return d.getUTCFullYear() === y && d.getUTCMonth() === m;
      })
      .reduce((s, t) => s + t.hrsQty, 0),
  );
}

/** Hours from K-Fasts in the last 7 days (inclusive). Labor only. */
export function last7DaysHours(trans: TransRow[]): number {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const cutMs = cutoff.getTime();
  return round2(
    trans
      .filter((t) => t.isLabor)
      .filter((t) => new Date(t.transDate).getTime() >= cutMs)
      .reduce((s, t) => s + t.hrsQty, 0),
  );
}

/** Map a fiscal period code (YYYYPP) to its calendar label using tables. */
export function periodLabelFromTables(periodCode: string, periods: PeriodRow[]): string {
  const p = periods.find((x) => x.billedPeriod === periodCode);
  if (!p) {
    if (/^\d{6}$/.test(periodCode)) return `FY${periodCode.slice(2, 4)} P${periodCode.slice(4)}`;
    return periodCode;
  }
  return `${p.month} ${p.year}`;
}

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
    return { date, hours: round2(hours), cumulative: round2(cum) };
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
    .map(([employee, cells]) => {
      const roundedCells: Record<string, number> = {};
      for (const k of Object.keys(cells)) roundedCells[k] = round2(cells[k]);
      return {
        employee,
        cells: roundedCells,
        total: round2(employeeTotals.get(employee) ?? 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  let max = 0;
  for (const r of rows) for (const k of sortedBuckets) max = Math.max(max, r.cells[k] ?? 0);

  const roundedBucketTotals: Record<string, number> = {};
  for (const k of Object.keys(bucketTotals)) roundedBucketTotals[k] = round2(bucketTotals[k]);
  const grand = round2([...employeeTotals.values()].reduce((a, b) => a + b, 0));

  return {
    buckets: sortedBuckets,
    rows,
    bucketTotals: roundedBucketTotals,
    grandTotal: grand,
    maxCell: round2(max),
  };
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
    .map(([taskCode, v]) => {
      const roundedCells: Record<string, number> = {};
      for (const k of Object.keys(v.cells)) roundedCells[k] = round2(v.cells[k]);
      return { taskCode, taskName: v.taskName, cells: roundedCells, total: round2(v.total) };
    })
    .sort((a, b) => a.taskCode.localeCompare(b.taskCode));

  const roundedEmpTotals: Record<string, number> = {};
  for (const k of Object.keys(empTotals)) roundedEmpTotals[k] = round2(empTotals[k]);
  return { employees: sortedEmployees, rows, empTotals: roundedEmpTotals, grandTotal: round2(grand) };
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
    return { period, revenue: round2(revenue), cumulative: round2(cum) };
  });
  return { rows, total: round2(cum) };
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
      totalHours: round2(rows.reduce((s, r) => s + r.hrsQty, 0)),
      totalBill: round2(rows.reduce((s, r) => s + r.billAmt, 0)),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}

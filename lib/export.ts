import * as XLSX from "xlsx";
import type { AllDataRow, ProjectMeta, TransRow } from "./types";
import {
  computeHealth,
  cumulativeHours,
  getProjectTotal,
  getTaskRows,
  revenueByPeriod,
  staffPivot,
  taskPivot,
} from "./calculations";

export async function exportProjectToXlsx(
  project: ProjectMeta,
  allData: AllDataRow[],
  trans: TransRow[],
) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const total = getProjectTotal(allData);
  const summaryRows: (string | number | null)[][] = [
    ["Project", project.name],
    ["Project number", project.id],
    ["PM", project.pmName],
    ["Last updated", project.uploadedAt],
    [],
  ];
  if (total) {
    const h = computeHealth(total);
    summaryRows.push(
      ["Health", h.label, h.reason],
      [],
      ["Total Fee", total.totalFee],
      ["JTD Net Revenue", total.netRev],
      ["Remaining", total.remainingTotalFee],
      ["% Revenue Taken", total.pctRevenueTaken],
      ["JTD Hours", total.jtdHours],
      ["MTD Hours", total.mtdHours],
      ["Last Week Hrs", total.lastWeekHrs],
      ["Profit %", total.profitPct],
      ["GM %", total.gmPct],
      ["Multiplier JTD", total.multiplierJtd],
      ["Target Multiplier JTD", total.targetMultiplierJtd],
      ["Start Date", total.startDate],
      ["Est Comp Date", total.estCompDate],
    );
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

  // Task Budget
  const taskRows = getTaskRows(allData);
  const tbHeader = [
    "Task Code",
    "Task",
    "Total Fee",
    "JTD Revenue",
    "Remaining",
    "JTD Hours",
    "Labor Cost",
    "% Revenue Taken",
    "Status",
  ];
  const tbBody = taskRows.map((t) => [
    t.taskCode,
    t.taskName,
    t.totalFee,
    t.netRev,
    t.remainingTotalFee,
    t.jtdHours,
    t.laborCost,
    t.pctRevenueTaken,
    t.pctRevenueTaken > 1 ? "Over" : t.pctRevenueTaken >= 0.85 ? "Watch" : "OK",
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([tbHeader, ...tbBody]),
    "Task Budget",
  );

  // Hours by Staff (weekly)
  const sp = staffPivot(trans, "week", null);
  const spHeader = ["Employee", ...sp.buckets, "Total"];
  const spBody = sp.rows.map((r) => [r.employee, ...sp.buckets.map((b) => r.cells[b] ?? 0), r.total]);
  const spFooter = ["Total", ...sp.buckets.map((b) => sp.bucketTotals[b] ?? 0), sp.grandTotal];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([spHeader, ...spBody, spFooter]),
    "Hours by Staff",
  );

  // Hours by Task
  const tp = taskPivot(trans);
  const tpHeader = ["Task Code", "Task", ...tp.employees, "Total"];
  const tpBody = tp.rows.map((r) => [
    r.taskCode,
    r.taskName,
    ...tp.employees.map((e) => r.cells[e] ?? 0),
    r.total,
  ]);
  const tpFooter = ["Total", "", ...tp.employees.map((e) => tp.empTotals[e] ?? 0), tp.grandTotal];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([tpHeader, ...tpBody, tpFooter]),
    "Hours by Task",
  );

  // Revenue by Period
  const rev = revenueByPeriod(trans);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Period", "Revenue", "Cumulative"],
      ...rev.rows.map((r) => [r.period, r.revenue, r.cumulative]),
      ["Total", rev.total, ""],
    ]),
    "Revenue by Period",
  );

  // Cumulative Hours
  const cum = cumulativeHours(trans);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Date", "Hours", "Cumulative"],
      ...cum.map((r) => [r.date, r.hours, r.cumulative]),
    ]),
    "Cumulative Hours",
  );

  // Transactions
  const txHeader = [
    "Date",
    "Task Code",
    "Task",
    "Employee/Vendor",
    "Hours",
    "NL Cost",
    "Rate",
    "Bill Amt",
    "Activity",
    "Bill Title",
    "Category",
    "Trans Type",
    "Bill Status",
    "Invoice",
    "Description",
    "Period",
  ];
  const txBody = trans.map((t) => [
    t.transDate.slice(0, 10),
    t.wbs2,
    t.taskName,
    t.empVenUnitName,
    t.hrsQty,
    t.nlCost,
    t.rate,
    t.billAmt,
    t.activity,
    t.billTitle,
    t.category,
    t.transType,
    t.billStatus,
    t.billedInvoice,
    t.commentDesc,
    t.period,
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([txHeader, ...txBody]),
    "Transactions",
  );

  const fname = `${project.id}_tracker_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

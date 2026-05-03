import * as XLSX from "xlsx";
import type { AllDataRow, ProjectMeta } from "../types";
import { safeNumber, safeString, toIsoDate } from "../utils";
import { detectPmWeb, sheetToMatrix } from "./detect";

function buildIndex(headerRow: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  headerRow.forEach((h, i) => {
    if (h === null || h === undefined) return;
    m.set(String(h).trim(), i);
  });
  return m;
}

function getCell(row: unknown[], idx: Map<string, number>, key: string): unknown {
  const i = idx.get(key);
  return i === undefined ? null : row[i];
}

function num(row: unknown[], idx: Map<string, number>, key: string): number {
  return safeNumber(getCell(row, idx, key));
}

function nullableNum(row: unknown[], idx: Map<string, number>, key: string): number | null {
  const v = getCell(row, idx, key);
  if (v === null || v === undefined || v === "" || v === "NaN") return null;
  return safeNumber(v);
}

function str(row: unknown[], idx: Map<string, number>, key: string): string | null {
  const v = getCell(row, idx, key);
  return v === null || v === undefined ? null : String(v).trim();
}

function parseTaskCode(taskNumberName: string): { code: string | null; name: string } {
  if (!taskNumberName) return { code: null, name: "" };
  const trimmed = taskNumberName.trim();
  // Patterns: "01-1000 - 1.1 Review..." OR "Total" OR " - OC San..." (orphan)
  const m = trimmed.match(/^(\d{2}-\d{4})\s*-\s*(.+)$/);
  if (m) return { code: m[1], name: m[2].trim() };
  return { code: null, name: trimmed };
}

function isSummaryTaskCode(code: string | null): boolean {
  if (!code) return false;
  return /-0000$/.test(code);
}

function projectIdFromName(name: string): string {
  // "26003153.001A - OC San- ..."
  const m = name.match(/^([A-Za-z0-9.\-]+)\s*-/);
  return m ? m[1] : name;
}

function projectShortName(name: string): string {
  const m = name.match(/^[A-Za-z0-9.\-]+\s*-\s*(.+)$/);
  return (m ? m[1] : name).trim();
}

export function parseAllData(wb: XLSX.WorkBook): {
  rows: AllDataRow[];
  meta: Pick<ProjectMeta, "id" | "name" | "shortName" | "pmName" | "startDate" | "estCompDate">;
} | null {
  const found = detectPmWeb(wb);
  if (!found) return null;
  const ws = wb.Sheets[found.sheetName];
  const matrix = sheetToMatrix(ws);
  const headerRow = matrix[found.headerRowIndex] ?? [];
  const idx = buildIndex(headerRow);

  const rows: AllDataRow[] = [];
  for (let r = found.headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    const projectName = str(raw, idx, "Project Number & Name");
    const taskNN = str(raw, idx, "Task Number & Name");
    if (!projectName && !taskNN) continue;
    const isTotal = (taskNN ?? "").trim().toLowerCase() === "total";
    const { code, name } = parseTaskCode(taskNN ?? "");
    const summary = isSummaryTaskCode(code);
    rows.push({
      projectNumberName: projectName ?? "",
      taskNumberName: taskNN ?? "",
      poNumber: str(raw, idx, "PO #"),
      pmName: str(raw, idx, "PM Name"),
      segment: str(raw, idx, "Segment"),
      billingClient: str(raw, idx, "Billing Client"),
      owner: str(raw, idx, "Owner"),
      projectType: str(raw, idx, "Project Type"),
      laborFee: num(raw, idx, "Labor Fee"),
      consultFee: num(raw, idx, "Consult Fee"),
      reimbFee: num(raw, idx, "Reimb Fee"),
      totalFee: num(raw, idx, "Total Fee"),
      remainingTotalFee: num(raw, idx, "Remaining Total Fee"),
      remainingLaborFee: num(raw, idx, "Remaining Labor Fee"),
      pctRevenueTaken: num(raw, idx, "% Revenue Taken"),
      jtdHours: num(raw, idx, "JTD Hours"),
      mtdHours: num(raw, idx, "MTD Hours"),
      lastWeekHrs: num(raw, idx, "Last Week Hrs"),
      laborRev: num(raw, idx, "Labor Rev"),
      subsRev: num(raw, idx, "Subs Rev"),
      reimbRev: num(raw, idx, "Reimb Rev"),
      otherRev: num(raw, idx, "Other Rev"),
      grossRev: num(raw, idx, "Gross Rev"),
      netRev: num(raw, idx, "Net Rev"),
      laborCost: num(raw, idx, "Labor Cost"),
      ohCost: num(raw, idx, "OH Cost"),
      subsCost: num(raw, idx, "Subs Cost"),
      reimbCost: num(raw, idx, "Reimb Cost"),
      totalCost: num(raw, idx, "Total Cost"),
      billedLabor: num(raw, idx, "Billed Labor"),
      billedSubs: num(raw, idx, "Billed Subs"),
      billedReimb: num(raw, idx, "Billed Reimb"),
      billedTotal: num(raw, idx, "Billed Total"),
      receivedAmount: num(raw, idx, "Received Amount"),
      arAmnt: num(raw, idx, "AR Amnt"),
      totalUnbilled: num(raw, idx, "Total Unbilled"),
      targetMultiplierJtd: nullableNum(raw, idx, "Target Multiplier JTD"),
      multiplierJtd: nullableNum(raw, idx, "Multiplier JTD"),
      targetMultiplierMtd: nullableNum(raw, idx, "Target Multiplier MTD"),
      multiplierMtd: nullableNum(raw, idx, "Multiplier MTD"),
      multiplierTtm: nullableNum(raw, idx, "Multiplier TTM"),
      profitPct: num(raw, idx, "Profit %"),
      gmPct: num(raw, idx, "GM %"),
      status: str(raw, idx, "Status"),
      startDate: toIsoDate(getCell(raw, idx, "Start Date")),
      estCompDate: toIsoDate(getCell(raw, idx, "Est Comp Date")),
      laborBacklog: num(raw, idx, "Labor Backlog"),
      billType: str(raw, idx, "Bill Type"),
      isTotalRow: isTotal,
      isSummaryTask: !isTotal && summary,
      taskCode: code,
      taskName: name,
    });
  }

  // Find a project name from the Total row, or the first row that has a name.
  const totalRow = rows.find((r) => r.isTotalRow) ?? rows[0];
  if (!totalRow) return null;
  const fullName = totalRow.projectNumberName || rows.find((r) => r.projectNumberName)?.projectNumberName || "Untitled project";
  const id = projectIdFromName(fullName);
  return {
    rows,
    meta: {
      id,
      name: fullName,
      shortName: projectShortName(fullName),
      pmName: totalRow.pmName ?? "",
      startDate: totalRow.startDate,
      estCompDate: totalRow.estCompDate,
    },
  };
}

export { safeString };

import type {
  AllDataRow,
  ChangeLogRow,
  CheckDetailRow,
  ETCRow,
  InvoiceLogData,
  InvoiceLogPeriod,
  InvoiceLogRow,
  InvoiceSummaryRow,
  NotesData,
  StaffData,
  StaffRow,
  SubManagementData,
  SubModRow,
  SubRow,
  TablesData,
  TaskBudgetRow,
  TaskSummaryRow,
  TransRow,
} from "../types";
import { safeNumber, toIsoDate } from "../utils";
import { Matrix, buildNormalizedHeaderIndex, findCol, normalizeHeader } from "./csv-detect";

// === Tiny helpers =================================================================

function num(row: string[], i: number | null): number {
  if (i === null || i === undefined) return 0;
  return safeNumber(row[i]);
}

function nullableNum(row: string[], i: number | null): number | null {
  if (i === null || i === undefined) return null;
  const v = row[i];
  if (v === undefined || v === null || v === "" || v === "NaN") return null;
  return safeNumber(v);
}

function str(row: string[], i: number | null): string {
  if (i === null || i === undefined) return "";
  const v = row[i];
  return v === undefined || v === null ? "" : String(v).trim();
}

function nullableStr(row: string[], i: number | null): string | null {
  if (i === null || i === undefined) return null;
  const v = row[i];
  if (v === undefined || v === null || String(v).trim() === "") return null;
  return String(v).trim();
}

function dateOrNull(row: string[], i: number | null): string | null {
  if (i === null || i === undefined) return null;
  return toIsoDate(row[i]);
}

function isAllEmpty(row: string[]): boolean {
  return row.every((c) => c === undefined || c === null || String(c).trim() === "");
}

// === PM Web All-Data ==============================================================

function parseTaskCode(taskNumberName: string): { code: string | null; name: string } {
  const trimmed = (taskNumberName ?? "").trim();
  const m = trimmed.match(/^(\d{2}-\d{4})\s*-\s*(.+)$/);
  if (m) return { code: m[1], name: m[2].trim() };
  return { code: null, name: trimmed };
}

const isSummaryTaskCode = (c: string | null) => !!c && /-0000$/.test(c);

function projectIdFromName(name: string): string {
  const m = name.match(/^([A-Za-z0-9.\-]+)\s*-/);
  return m ? m[1] : name;
}

function projectShortName(name: string): string {
  const m = name.match(/^[A-Za-z0-9.\-]+\s*-\s*(.+)$/);
  return (m ? m[1] : name).trim();
}

export function parseAllDataCsv(
  matrix: Matrix,
  headerRowIndex: number,
): { rows: AllDataRow[]; meta: { id: string; name: string; shortName: string; pmName: string; startDate: string | null; estCompDate: string | null } } | null {
  const headerRow = matrix[headerRowIndex] ?? [];
  const idx = buildNormalizedHeaderIndex(headerRow);
  const col = (cands: string[]) => findCol(idx, cands);

  const rows: AllDataRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (isAllEmpty(raw)) continue;
    const taskNN = str(raw, col(["Task Number & Name"]));
    const projectName = str(raw, col(["Project Number & Name"]));
    if (!taskNN && !projectName) continue;
    const isTotal = taskNN.toLowerCase() === "total";
    const { code, name } = parseTaskCode(taskNN);
    rows.push({
      projectNumberName: projectName,
      taskNumberName: taskNN,
      poNumber: nullableStr(raw, col(["PO #"])),
      pmName: nullableStr(raw, col(["PM Name"])),
      segment: nullableStr(raw, col(["Segment"])),
      billingClient: nullableStr(raw, col(["Billing Client"])),
      owner: nullableStr(raw, col(["Owner"])),
      projectType: nullableStr(raw, col(["Project Type"])),
      laborFee: num(raw, col(["Labor Fee"])),
      consultFee: num(raw, col(["Consult Fee"])),
      reimbFee: num(raw, col(["Reimb Fee"])),
      totalFee: num(raw, col(["Total Fee"])),
      remainingTotalFee: num(raw, col(["Remaining Total Fee"])),
      remainingLaborFee: num(raw, col(["Remaining Labor Fee"])),
      pctRevenueTaken: num(raw, col(["% Revenue Taken"])),
      jtdHours: num(raw, col(["JTD Hours"])),
      mtdHours: num(raw, col(["MTD Hours"])),
      lastWeekHrs: num(raw, col(["Last Week Hrs"])),
      laborRev: num(raw, col(["Labor Rev"])),
      subsRev: num(raw, col(["Subs Rev"])),
      reimbRev: num(raw, col(["Reimb Rev"])),
      otherRev: num(raw, col(["Other Rev"])),
      grossRev: num(raw, col(["Gross Rev"])),
      netRev: num(raw, col(["Net Rev"])),
      laborCost: num(raw, col(["Labor Cost"])),
      ohCost: num(raw, col(["OH Cost"])),
      subsCost: num(raw, col(["Subs Cost"])),
      reimbCost: num(raw, col(["Reimb Cost"])),
      totalCost: num(raw, col(["Total Cost"])),
      billedLabor: num(raw, col(["Billed Labor"])),
      billedSubs: num(raw, col(["Billed Subs"])),
      billedReimb: num(raw, col(["Billed Reimb"])),
      billedTotal: num(raw, col(["Billed Total"])),
      receivedAmount: num(raw, col(["Received Amount"])),
      arAmnt: num(raw, col(["AR Amnt"])),
      totalUnbilled: num(raw, col(["Total Unbilled"])),
      targetMultiplierJtd: nullableNum(raw, col(["Target Multiplier JTD"])),
      multiplierJtd: nullableNum(raw, col(["Multiplier JTD"])),
      targetMultiplierMtd: nullableNum(raw, col(["Target Multiplier MTD"])),
      multiplierMtd: nullableNum(raw, col(["Multiplier MTD"])),
      multiplierTtm: nullableNum(raw, col(["Multiplier TTM"])),
      profitPct: num(raw, col(["Profit %"])),
      gmPct: num(raw, col(["GM %"])),
      status: nullableStr(raw, col(["Status"])),
      startDate: dateOrNull(raw, col(["Start Date"])),
      estCompDate: dateOrNull(raw, col(["Est Comp Date"])),
      laborBacklog: num(raw, col(["Labor Backlog"])),
      billType: nullableStr(raw, col(["Bill Type"])),
      isTotalRow: isTotal,
      isSummaryTask: !isTotal && isSummaryTaskCode(code),
      taskCode: code,
      taskName: name,
    });
  }

  const total = rows.find((r) => r.isTotalRow) ?? rows[0];
  if (!total) return null;
  const fullName = total.projectNumberName || rows.find((r) => r.projectNumberName)?.projectNumberName || "Untitled project";
  const id = projectIdFromName(fullName);
  return {
    rows,
    meta: {
      id,
      name: fullName,
      shortName: projectShortName(fullName),
      pmName: total.pmName ?? "",
      startDate: total.startDate,
      estCompDate: total.estCompDate,
    },
  };
}

// === K-Fasts trans ================================================================

/**
 * Labor heuristic for a K-Fasts trans row.
 * Primary signal: Activity Group starts with "L-" (e.g. "L-Foundation Engineering").
 * Secondary: TransType "TS" = TimeSheet (always labor).
 * Fallback: employee name has lowercase letters and isn't all-caps (vendors are usually all caps).
 */
function isLabor(
  activity: string | null,
  transType: string | null,
  employee: string | null,
  hrsQty: number,
): boolean {
  if (activity && /^L-/i.test(activity)) return true;
  if (transType && /^TS$/i.test(transType)) return true;
  // Last resort: only treat as labor if there are hours AND name looks like a person.
  if (hrsQty > 0 && employee && /[a-z]/.test(employee) && !/^[A-Z\s.,&]+$/.test(employee)) {
    return true;
  }
  return false;
}

/** Round to 2 decimal places to avoid float accumulation drift. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseTransCsv(matrix: Matrix, headerRowIndex: number): TransRow[] {
  const headerRow = matrix[headerRowIndex] ?? [];
  const idx = buildNormalizedHeaderIndex(headerRow);
  const col = (cands: string[]) => findCol(idx, cands);

  const rows: TransRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (isAllEmpty(raw)) continue;
    const wbs2 = str(raw, col(["WBS2"]));
    if (!wbs2 || /^Total$/i.test(wbs2)) continue;
    const transDate = dateOrNull(raw, col(["TransDate"]));
    if (!transDate) continue;
    const empVenUnitName = str(raw, col(["EmpVenUnitName"]));
    const activity = nullableStr(raw, col(["Activity"]));
    const transType = nullableStr(raw, col(["TransType"]));
    const category = nullableStr(raw, col(["Category"]));
    const periodVal = str(raw, col(["Period"]));
    const hrsQty = r2(num(raw, col(["HrsQty"])));
    rows.push({
      wbs2,
      taskName: str(raw, col(["TaskName"])),
      transDate,
      empVenUnitName,
      hrsQty,
      nlCost: r2(num(raw, col(["NLCost"]))),
      rate: r2(num(raw, col(["Rate"]))),
      billAmt: r2(num(raw, col(["BillAmt"]))),
      activity,
      billTitle: nullableStr(raw, col(["BillTitle"])),
      invDescription: nullableStr(raw, col(["InvDescription"])),
      category,
      transType,
      billStatus: nullableStr(raw, col(["BillStatus"])),
      billedInvoice: nullableStr(raw, col(["BilledInvoice"])),
      commentDesc: nullableStr(raw, col(["CommentDesc"])),
      period: periodVal || null,
      postSeq: nullableNum(raw, col(["PostSeq"])),
      isLabor: isLabor(activity, transType, empVenUnitName, hrsQty),
    });
  }
  return rows;
}

// === Invoice Summary ==============================================================

export function parseInvoiceSummaryCsv(matrix: Matrix, headerRowIndex: number): InvoiceSummaryRow[] {
  const headerRow = matrix[headerRowIndex] ?? [];
  const idx = buildNormalizedHeaderIndex(headerRow);
  const col = (cands: string[]) => findCol(idx, cands);

  const rows: InvoiceSummaryRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (isAllEmpty(raw)) continue;
    const task = str(raw, col(["Task"]));
    const desc = str(raw, col(["Task Description"]));
    if (!task && !desc) continue;
    if (/^Total$/i.test(task) || /^Grand Total$/i.test(task)) continue;
    rows.push({
      task,
      taskDescription: desc,
      totalFee: num(raw, col(["Total FEE", "Total Fee"])),
      estCurrentInvoice: num(raw, col(["Estimated Current Invoice", "Est Current Invoice"])),
      cumInvoiceToDate: num(raw, col(["Cum Invoice To Date"])),
      jtdRevenue: num(raw, col(["JTD Revenue"])),
      estimateAtComplete: num(raw, col(["Estimate AT Complete", "Estimate At Complete"])),
      pctSpent: num(raw, col(["% Spent"])),
      pctComp: num(raw, col(["% Comp", "% Complete"])),
      paidToDate: num(raw, col(["Paid To Date"])),
      arOver60: num(raw, col(["AR Over 60"])),
      nrm: num(raw, col(["NRM"])),
    });
  }
  return rows;
}

// === Task Summary / Task Budget ===================================================

function parseTaskRow(raw: string[], col: (cands: string[]) => number | null): TaskSummaryRow {
  return {
    sumTask: str(raw, col(["Sum Task", "SumTask"])),
    taskNo: str(raw, col(["Task No", "Task Number"])),
    taskDescription: str(raw, col(["Task Description"])),
    laborFee: num(raw, col(["Labor Fee"])),
    reimbursableFee: num(raw, col(["Reimburseable Fee", "Reimbursable Fee"])),
    labFee: num(raw, col(["Lab Fee"])),
    subFee: num(raw, col(["Sub Fee"])),
    changeOrderAmt: num(raw, col(["Change Order Amt"])),
    totalFee: num(raw, col(["Total FEE", "Total Fee"])),
    jtdRevenue: num(raw, col(["JTD Revenue"])),
    feeRemaining: num(raw, col(["Fee Remaining"])),
    pctComplete: num(raw, col(["Estimated Work % Complete", "% Complete"])),
    estimateToComp: num(raw, col(["Estimate To Comp", "Estimate to Comp", "Estimate Comp"])),
    estimateAtComp: num(raw, col(["Estimate At Comp", "Estimate at Comp"])),
    variance: num(raw, col(["Variance"])),
    pctSpent: num(raw, col(["% Spent"])),
    startDate: dateOrNull(raw, col(["Start Date"])),
    endDate: dateOrNull(raw, col(["End Date"])),
  };
}

export function parseTaskSummaryCsv(matrix: Matrix, headerRowIndex: number): TaskSummaryRow[] {
  const headerRow = matrix[headerRowIndex] ?? [];
  const idx = buildNormalizedHeaderIndex(headerRow);
  const col = (cands: string[]) => findCol(idx, cands);

  const rows: TaskSummaryRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (isAllEmpty(raw)) continue;
    const sumTask = str(raw, col(["Sum Task", "SumTask"]));
    const taskDesc = str(raw, col(["Task Description"]));
    if (!sumTask && !taskDesc) continue;
    if (/^Total$/i.test(sumTask) || /^Grand Total$/i.test(taskDesc)) continue;
    rows.push(parseTaskRow(raw, col));
  }
  return rows;
}

export function parseTaskBudgetCsv(matrix: Matrix, headerRowIndex: number): TaskBudgetRow[] {
  const headerRow = matrix[headerRowIndex] ?? [];
  const idx = buildNormalizedHeaderIndex(headerRow);
  const col = (cands: string[]) => findCol(idx, cands);

  const rows: TaskBudgetRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (isAllEmpty(raw)) continue;
    const sumTask = str(raw, col(["Sum Task", "SumTask"]));
    const taskNo = str(raw, col(["Task No", "Task Number"]));
    const taskDesc = str(raw, col(["Task Description"]));
    if (!sumTask && !taskNo && !taskDesc) continue;
    if (/^Total$/i.test(sumTask) || /^Grand Total$/i.test(taskDesc)) continue;
    const base = parseTaskRow(raw, col);
    rows.push({ ...base, isSummaryHeader: /-0000$/.test(taskNo) });
  }
  return rows;
}

// === ETC ==========================================================================

export function parseEtcCsv(matrix: Matrix, headerRowIndex: number): ETCRow[] {
  const headerRow = matrix[headerRowIndex] ?? [];
  const idx = buildNormalizedHeaderIndex(headerRow);
  const col = (cands: string[]) => findCol(idx, cands);

  const rows: ETCRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (isAllEmpty(raw)) continue;
    const sumTask = str(raw, col(["SumTask", "Sum Task"]));
    const task = str(raw, col(["Task", "Task No"]));
    const staff = str(raw, col(["Staff"]));
    if (!sumTask && !task && !staff) continue;
    if (/^Total$/i.test(staff) || /^Grand Total$/i.test(staff)) continue;
    rows.push({
      sumTask,
      filter: str(raw, col(["Filter"])),
      task,
      taskDescription: str(raw, col(["Task Description"])),
      staff,
      discipline: str(raw, col(["Discpline", "Discipline"])),
      type: str(raw, col(["Type"])),
      billingRate: num(raw, col(["Billing Rate"])),
      budgetHrs: num(raw, col(["Budget HRS"])),
      actualsHrs: num(raw, col(["Actuals HRS", "Actual HRS"])),
      etcHrs: num(raw, col(["Est To Comp HRS", "ETC HRS"])),
      pctSpent: num(raw, col(["% Spent"])),
      budgetCost: num(raw, col(["Budget COST", "Budget Cost"])),
      actualCost: num(raw, col(["Actual COST", "Actual Cost"])),
      etcCost: num(raw, col(["ETC COST", "ETC Cost", "Est To Comp COST"])),
      eacCost: num(raw, col(["EAC COST", "EAC Cost", "Estimate At Complete COST"])),
      vac: num(raw, col(["VAC", "Variance At Completion"])),
    });
  }
  return rows;
}

// === Invoice Log ==================================================================

export function parseInvoiceLogCsv(matrix: Matrix, headerRowIndex: number): InvoiceLogData {
  const headerRow = matrix[headerRowIndex] ?? [];
  const fixedCols = ["Firm", "NTP Date", "Budget", "Remaining Budget", "Cum Invoice", "% Spent", "Previous"];
  // Build periods: every column past "Previous" whose header parses as a date
  const periods: InvoiceLogPeriod[] = [];
  const periodColIdx: number[] = [];
  for (let i = 0; i < headerRow.length; i++) {
    const cell = (headerRow[i] ?? "").trim();
    if (!cell) continue;
    if (fixedCols.some((f) => normalizeHeader(f) === normalizeHeader(cell))) continue;
    const iso = toIsoDate(cell);
    if (iso) {
      const d = new Date(iso);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      periods.push({ date: iso, label });
      periodColIdx.push(i);
    }
  }

  const idx = buildNormalizedHeaderIndex(headerRow);
  const col = (cands: string[]) => findCol(idx, cands);

  const rows: InvoiceLogRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (isAllEmpty(raw)) continue;
    const firm = str(raw, col(["Firm"]));
    if (!firm || /^Total$/i.test(firm) || /^Grand Total$/i.test(firm)) continue;
    const byPeriod: Record<string, number> = {};
    periods.forEach((p, i) => {
      byPeriod[p.date] = num(raw, periodColIdx[i]);
    });
    rows.push({
      firm,
      ntpDate: dateOrNull(raw, col(["NTP Date"])),
      budget: num(raw, col(["Budget"])),
      remainingBudget: num(raw, col(["Remaining Budget"])),
      cumInvoice: num(raw, col(["Cum Invoice"])),
      pctSpent: num(raw, col(["% Spent"])),
      byPeriod,
    });
  }
  return { rows, periods };
}

// === Change Log ===================================================================

export function parseChangeLogCsv(matrix: Matrix, headerRowIndex: number): ChangeLogRow[] {
  const headerRow = matrix[headerRowIndex] ?? [];
  const idx = buildNormalizedHeaderIndex(headerRow);
  const col = (cands: string[]) => findCol(idx, cands);

  const rows: ChangeLogRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (isAllEmpty(raw)) continue;
    const changeNo = str(raw, col(["Change No.", "Change No"]));
    const desc = str(raw, col(["Change Request Description", "Description"]));
    if (!changeNo && !desc) continue;
    if (/^Total$/i.test(changeNo) || /^Grand Total$/i.test(changeNo)) continue;
    rows.push({
      changeNo,
      description: desc,
      leadContact: str(raw, col(["Change Lead Contact", "Lead Contact"])),
      estimatedCost: num(raw, col(["Estimated Cost"])),
      estDaysDelay: num(raw, col(["Estimated No of Cal Days Delay", "Est Days Delay", "Days Delay"])),
      status: str(raw, col(["Status"])),
      submittedDate: dateOrNull(raw, col(["Submitted Date"])),
      approvedDate: dateOrNull(raw, col(["Approved Date"])),
    });
  }
  return rows;
}

// === Sub Management (two side-by-side tables) =====================================

export function parseSubManagementCsv(matrix: Matrix): SubManagementData {
  // Find the row that contains "Firm Name", "Ori Fee", "Approved Fee" — that's the sub-table header
  let subHeader = -1;
  let modsHeader = -1;
  let subStart = 0;
  let modsStart = 0;
  for (let r = 0; r < Math.min(matrix.length, 10); r++) {
    const row = matrix[r] ?? [];
    const labels = row.map((c) => normalizeHeader(c ?? ""));
    // SUB cluster
    const firmCol = labels.indexOf("firm");
    const firmNameCol = labels.indexOf("firm name");
    const oriFeeCol = labels.indexOf("ori fee");
    const approvedFeeCol = labels.indexOf("approved fee");
    if (firmCol >= 0 && firmNameCol >= 0 && oriFeeCol >= 0 && approvedFeeCol >= 0) {
      subHeader = r;
      subStart = firmCol;
    }
    // MODS cluster — second occurrence of "firm" (after first), or "Mod 01"
    const mod01 = labels.indexOf("mod 01");
    if (mod01 >= 0) {
      modsHeader = r;
      // mods table firm column is the closest "firm" left of "Ori Fee" left of "Mod 01"
      // Find the rightmost "firm" before mod01
      const firms = labels.map((v, i) => (v === "firm" ? i : -1)).filter((i) => i >= 0 && i < mod01);
      modsStart = firms.length > 0 ? firms[firms.length - 1] : 0;
    }
  }

  const subs: SubRow[] = [];
  const mods: SubModRow[] = [];

  if (subHeader >= 0) {
    const headerRow = matrix[subHeader] ?? [];
    const subSlice = headerRow.slice(subStart);
    const idx = buildNormalizedHeaderIndex(subSlice);
    const col = (cands: string[]) => findCol(idx, cands);
    const remap = (i: number | null) => (i === null ? null : i + subStart);

    for (let r = subHeader + 1; r < matrix.length; r++) {
      const raw = matrix[r] ?? [];
      if (isAllEmpty(raw)) continue;
      const firm = str(raw, remap(col(["Firm"])));
      const firmName = str(raw, remap(col(["Firm Name"])));
      if (!firm && !firmName) continue;
      if (/^Total$/i.test(firm) || /^Grand Total$/i.test(firm)) continue;
      subs.push({
        firm,
        firmName,
        oriFee: num(raw, remap(col(["Ori Fee", "Original Fee"]))),
        mods: num(raw, remap(col(["Mods"]))),
        approvedFee: num(raw, remap(col(["Approved Fee"]))),
        invoicedToDate: num(raw, remap(col(["Invoiced To Date"]))),
        remaining: num(raw, remap(col(["Remaining"]))),
      });
    }
  }

  if (modsHeader >= 0) {
    const headerRow = matrix[modsHeader] ?? [];
    const modsSlice = headerRow.slice(modsStart);
    const idx = buildNormalizedHeaderIndex(modsSlice);
    const col = (cands: string[]) => findCol(idx, cands);
    const remap = (i: number | null) => (i === null ? null : i + modsStart);

    for (let r = modsHeader + 1; r < matrix.length; r++) {
      const raw = matrix[r] ?? [];
      if (isAllEmpty(raw)) continue;
      const firm = str(raw, remap(col(["Firm"])));
      if (!firm) continue;
      if (/^Total$/i.test(firm) || /^Grand Total$/i.test(firm)) continue;
      mods.push({
        firm,
        oriFee: num(raw, remap(col(["Ori Fee", "Original Fee"]))),
        mod01: num(raw, remap(col(["Mod 01"]))),
        approvedDate: dateOrNull(raw, remap(col(["Approved Date"]))),
      });
    }
  }

  return { subs, mods };
}

// === Staff ========================================================================

export function parseStaffCsv(matrix: Matrix): StaffData {
  // Find header row: contains "Firm", "Type", "Discpline" (or Discipline), "Name", "Title"
  let header = -1;
  for (let r = 0; r < Math.min(matrix.length, 10); r++) {
    const labels = (matrix[r] ?? []).map((c) => normalizeHeader(c ?? ""));
    if (labels.includes("firm") && labels.includes("name") && (labels.includes("discpline") || labels.includes("discipline"))) {
      header = r;
      break;
    }
  }
  if (header < 0) return { rows: [], projectMultiplier: null };

  // Project multiplier may be in a row above the header (from sample: row 3 col 5 = "2.6953")
  let projectMultiplier: number | null = null;
  for (let r = 0; r < header; r++) {
    const row = matrix[r] ?? [];
    for (const cell of row) {
      const n = parseFloat(cell ?? "");
      if (Number.isFinite(n) && n > 1.5 && n < 5) {
        projectMultiplier = n;
        break;
      }
    }
    if (projectMultiplier !== null) break;
  }

  const headerRow = matrix[header] ?? [];
  const idx = buildNormalizedHeaderIndex(headerRow);
  const col = (cands: string[]) => findCol(idx, cands);

  const rows: StaffRow[] = [];
  for (let r = header + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (isAllEmpty(raw)) continue;
    const firm = str(raw, col(["Firm"]));
    const name = str(raw, col(["Name"]));
    if (!firm && !name) continue;
    if (/^Total$/i.test(name) || /^Grand Total$/i.test(name)) continue;
    rows.push({
      firm,
      type: str(raw, col(["Type"])),
      discipline: str(raw, col(["Discpline", "Discipline"])),
      name,
      title: str(raw, col(["Title"])),
      fy25Rate: num(raw, col(["FY25 Rate", "FY25"])),
      fy26Rate: num(raw, col(["FY26 Rate", "FY26"])),
    });
  }
  return { rows, projectMultiplier };
}

// === Notes ========================================================================

const NOTES_FIELDS = [
  "Project Name",
  "Project Manager",
  "Provisional PM",
  "Technical Lead",
  "Risk Register",
  "Safety",
  "APM",
  "Lead PCS",
  "Accountant",
  "Sub Management",
  "Prevailing Wage",
  "DIR Project No.",
  "WC",
  "RFP Date",
  "Dir Determination",
  "PLA",
];

export function parseNotesCsv(matrix: Matrix): NotesData {
  const fields: Record<string, string> = {};
  let freeform = "";
  let inFreeform = false;
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const k = (row[0] ?? "").trim();
    const v = (row[1] ?? "").trim();
    if (!k && !v) continue;
    // Strip trailing colon
    const key = k.replace(/:\s*$/, "");
    if (NOTES_FIELDS.includes(key)) {
      fields[key] = v;
      continue;
    }
    // After known fields → free-form notes
    if (key) {
      inFreeform = true;
      freeform += (freeform ? "\n" : "") + (v ? `${key}: ${v}` : key);
    } else if (inFreeform) {
      freeform += `\n${v}`;
    }
  }
  // ensure all keys exist for the form
  for (const f of NOTES_FIELDS) if (!(f in fields)) fields[f] = "";
  return { fields, freeform };
}

// === Check Detail =================================================================

export function parseCheckDetailCsv(matrix: Matrix, headerRowIndex: number): CheckDetailRow[] {
  const headerRow = matrix[headerRowIndex] ?? [];
  const idx = buildNormalizedHeaderIndex(headerRow);
  const col = (cands: string[]) => findCol(idx, cands);

  const rows: CheckDetailRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (isAllEmpty(raw)) continue;
    const wbs2 = str(raw, col(["WBS2"]));
    const taskName = str(raw, col(["TaskName", "Task Name"]));
    const emp = str(raw, col(["EmpVenUnitName", "Employee"]));
    if (!wbs2 && !taskName) continue;
    if (/^Grand Total$/i.test(wbs2)) continue;
    const isSubtotal = / Total$/i.test(taskName) && !emp;
    rows.push({
      wbs2,
      taskName: taskName.replace(/ Total$/i, ""),
      empVenUnitName: emp,
      hrsQty: num(raw, col(["Sum of HrsQty", "HrsQty"])),
      billAmt: num(raw, col(["Sum of BillAmt", "BillAmt"])),
      isSubtotal,
    });
  }
  return rows;
}

// === Tables (Periods + Tasks + SumTasks side-by-side) =============================

export function parseTablesCsv(matrix: Matrix): TablesData {
  // Find the row containing "Billed Period" (PERIODS table) and column starts for other tables.
  let header = -1;
  let periodsCol = -1;
  let tasksCol = -1;
  let sumTasksCol = -1;
  for (let r = 0; r < Math.min(matrix.length, 8); r++) {
    const row = matrix[r] ?? [];
    const labels = row.map((c) => normalizeHeader(c ?? ""));
    const bp = labels.indexOf("billed period");
    const tn = labels.indexOf("task no");
    const st = labels.indexOf("sumtask");
    if (bp >= 0 && tn >= 0 && st >= 0) {
      header = r;
      periodsCol = bp;
      tasksCol = tn;
      sumTasksCol = st;
      break;
    }
  }
  if (header < 0) return { periods: [], tasks: [], sumTasks: [] };

  const periods: TablesData["periods"] = [];
  const tasks: TablesData["tasks"] = [];
  const sumTasks: TablesData["sumTasks"] = [];

  for (let r = header + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (isAllEmpty(raw)) continue;
    // periods (cols periodsCol..periodsCol+3)
    const billedPeriod = (raw[periodsCol] ?? "").trim();
    if (billedPeriod && /^\d{6}$/.test(billedPeriod)) {
      periods.push({
        billedPeriod,
        month: (raw[periodsCol + 1] ?? "").trim(),
        year: (raw[periodsCol + 2] ?? "").trim(),
        date: toIsoDate(raw[periodsCol + 3] ?? ""),
      });
    }
    // tasks (cols tasksCol..tasksCol+3)
    const taskNo = (raw[tasksCol] ?? "").trim();
    if (taskNo) {
      tasks.push({
        taskNo,
        taskDescription: (raw[tasksCol + 1] ?? "").trim(),
        taskNoDescription: (raw[tasksCol + 2] ?? "").trim(),
        summaryTask: (raw[tasksCol + 3] ?? "").trim(),
      });
    }
    // sumTasks (cols sumTasksCol..sumTasksCol+2)
    const sumTask = (raw[sumTasksCol] ?? "").trim();
    if (sumTask) {
      sumTasks.push({
        sumTask,
        summaryDescription: (raw[sumTasksCol + 1] ?? "").trim(),
        summaryNoDescriptions: (raw[sumTasksCol + 2] ?? "").trim(),
      });
    }
  }
  return { periods, tasks, sumTasks };
}

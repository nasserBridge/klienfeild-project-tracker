import Papa from "papaparse";
import type { CsvKind, DetectionResult } from "../types";

export type Matrix = string[][];

/** Parse CSV content as a 2D string matrix. Empty cells → "". */
export function parseCsvMatrix(content: string): Matrix {
  const r = Papa.parse<string[]>(content, {
    skipEmptyLines: false,
    header: false,
  });
  return (r.data ?? []).map((row) => row.map((c) => (c == null ? "" : String(c))));
}

/** Build a Map<headerLabel, columnIndex> for a header row. Strips line breaks/whitespace. */
export function buildHeaderIndex(row: string[]): Map<string, number> {
  const m = new Map<string, number>();
  row.forEach((cell, i) => {
    const key = (cell ?? "").replace(/\s+/g, " ").trim();
    if (key) m.set(key, i);
  });
  return m;
}

const COUNT_NON_EMPTY = (row: string[]): number => row.filter((c) => c && c.trim() !== "").length;

function findRowContaining(matrix: Matrix, tokens: string[], maxRow = 12): number {
  for (let r = 0; r < Math.min(matrix.length, maxRow); r++) {
    const row = matrix[r] ?? [];
    const set = new Set(row.map((c) => (c ?? "").replace(/\s+/g, " ").trim()));
    if (tokens.every((t) => set.has(t))) return r;
  }
  return -1;
}

function rowJoin(row: string[]) {
  return (row ?? []).join("|").toLowerCase();
}

/** Detection signatures for each CSV kind. Order matters — first match wins. */
export function detectCsv(matrix: Matrix): DetectionResult {
  // K-Fasts trans: machine-headers row "WBS2,TaskName,TransDate,EmpVenUnitName,HrsQty"
  const kfasts = findRowContaining(matrix, ["WBS2", "TaskName", "TransDate", "EmpVenUnitName", "HrsQty"]);
  if (kfasts >= 0) {
    return { kind: "trans", headerRowIndex: kfasts, label: "K-Fasts Proj Trans Detail" };
  }

  // PM Web All-Data: header row contains both "Project Number & Name" and "Total Fee" + "JTD Hours"
  const pm = findRowContaining(matrix, ["Project Number & Name", "Task Number & Name", "Total Fee", "JTD Hours"]);
  if (pm >= 0) {
    return { kind: "all-data", headerRowIndex: pm, label: "PM Web All-Data Export" };
  }

  // tables.csv — has "Table: PERIODS"
  if (matrix.slice(0, 6).some((r) => r.some((c) => /Table:\s*PERIODS/i.test(c ?? "")))) {
    return { kind: "tables", headerRowIndex: null, label: "Periods / Tasks / SumTasks lookup" };
  }

  // notes.csv — first non-empty value cells include "Project Name:" key
  if (matrix.slice(0, 12).some((r) => r.some((c) => /^Project Name:?$/i.test((c ?? "").trim())))) {
    return { kind: "notes", headerRowIndex: null, label: "Project notes" };
  }

  // sub_management.csv — has "Table: SUB" or "Table: MODS"
  if (matrix.slice(0, 8).some((r) => r.some((c) => /Table:\s*SUB|Table:\s*MODS/i.test(c ?? "")))) {
    return { kind: "sub-management", headerRowIndex: null, label: "Sub Management" };
  }

  // staff.csv — has "Table: STAFF"
  if (matrix.slice(0, 8).some((r) => r.some((c) => /Table:\s*STAFF/i.test(c ?? "")))) {
    return { kind: "staff", headerRowIndex: null, label: "Staff list" };
  }

  // check_detail.csv — header has "Sum of HrsQty" + "Sum of BillAmt"
  const cd = findRowContaining(matrix, ["WBS2", "TaskName", "EmpVenUnitName", "Sum of HrsQty", "Sum of BillAmt"]);
  if (cd >= 0) {
    return { kind: "check-detail", headerRowIndex: cd, label: "Check Detail (PM hours pivot)" };
  }

  // change_log.csv — header has "Change No." + "Change Request Description"
  const cl = findRowContaining(matrix, ["Change No.", "Change Request Description"]);
  if (cl >= 0) {
    return { kind: "change-log", headerRowIndex: cl, label: "Change Log" };
  }

  // invoice_log.csv — header has "Firm" + "NTP Date" + "Cum Invoice"
  const il = findRowContaining(matrix, ["Firm", "NTP Date", "Budget", "Cum Invoice"]);
  if (il >= 0) {
    return { kind: "invoice-log", headerRowIndex: il, label: "Invoice Log" };
  }

  // ETC csv — header has "SumTask", "Filter", "Staff", "Discpline" or "Discipline"
  const etcRow = findRowContaining(matrix, ["SumTask", "Filter", "Staff"]);
  if (etcRow >= 0) {
    return { kind: "etc", headerRowIndex: etcRow, label: "ETC (Estimate to Complete)" };
  }

  // Invoice Summary — header has "Cum Invoice To Date" or "Estimated Current Invoice" + "% Spent"
  const isum = findRowContainingAny(matrix, [
    ["Cum Invoice To Date", "Paid To Date"],
    ["Estimated Current Invoice", "Paid To Date"],
  ]);
  if (isum >= 0) {
    return { kind: "invoice-summary", headerRowIndex: isum, label: "Invoice Summary" };
  }

  // Task Budget vs. Task Summary — both share the same header. Task Budget rows start with sub-task codes,
  // task summary rows do not. Look at the first data row's "Task No" cell.
  const ts = findRowContainingAny(matrix, [
    ["Sum Task", "Task Description", "Total FEE"],
    ["Sum Task", "Task Description", "JTD Revenue"],
    ["SumTask", "Task Description", "Estimate To Comp"],
  ]);
  if (ts >= 0) {
    // Decide between task_summary and task_budget by inspecting first data row
    const firstData = matrix[ts + 1] ?? [];
    const taskNoCell = (firstData[1] ?? "").trim();
    // Task Budget: "01-0000", "01-1000", etc. Task Summary: empty or just sum-task code "01"
    if (/^\d{2}-\d{4}$/.test(taskNoCell)) {
      return { kind: "task-budget", headerRowIndex: ts, label: "Task Budget (sub-tasks)" };
    }
    // Try the next row too — sometimes ROI of headers
    const nextTaskNoCell = (matrix[ts + 2]?.[1] ?? "").trim();
    if (/^\d{2}-\d{4}$/.test(nextTaskNoCell)) {
      return { kind: "task-budget", headerRowIndex: ts, label: "Task Budget (sub-tasks)" };
    }
    return { kind: "task-summary", headerRowIndex: ts, label: "Task Summary" };
  }

  return { kind: "unknown", headerRowIndex: null, label: "Unknown CSV" };
}

function findRowContainingAny(matrix: Matrix, optionLists: string[][]): number {
  for (const opts of optionLists) {
    const r = findRowContaining(matrix, opts);
    if (r >= 0) return r;
  }
  return -1;
}

/** Read a File as text, then parse to matrix. */
export async function readCsvFile(file: File): Promise<Matrix> {
  const text = await file.text();
  return parseCsvMatrix(text);
}

/** Normalize a header label for fuzzy match: strip whitespace/newlines/punctuation. */
export function normalizeHeader(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Build a normalized header → index map. */
export function buildNormalizedHeaderIndex(row: string[]): Map<string, number> {
  const m = new Map<string, number>();
  row.forEach((cell, i) => {
    const k = normalizeHeader(cell ?? "");
    if (k) m.set(k, i);
  });
  return m;
}

/** Find header column by trying each candidate label until one matches. */
export function findCol(idx: Map<string, number>, candidates: string[]): number | null {
  for (const c of candidates) {
    const k = normalizeHeader(c);
    if (idx.has(k)) return idx.get(k)!;
  }
  return null;
}

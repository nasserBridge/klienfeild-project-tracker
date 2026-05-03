import * as XLSX from "xlsx";
import type { DetectionResult } from "../types";

const PMWEB_REQUIRED = ["Project Number & Name", "Task Number & Name", "Total Fee", "JTD Hours"];
const PMWEB_HELPFUL = ["Multiplier JTD", "Labor Cost", "% Revenue Taken", "Billed Total"];

const TRANS_TOKENS = ["WBS2", "TaskName", "TransDate", "EmpVenUnitName", "HrsQty"];
const TRANS_LABEL_TOKENS = ["Transaction Date", "Employee, Vendor, or Unit Name", "Hours or Qty"];

/** Read a sheet as a 2D array of cells, raw — preserves Date objects. */
export function sheetToMatrix(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as unknown[][];
}

function rowAsStrings(row: unknown[]): string[] {
  return row.map((c) => (c === null || c === undefined ? "" : String(c).trim()));
}

function matchCount(row: string[], needles: string[]): number {
  const set = new Set(row);
  return needles.filter((n) => set.has(n)).length;
}

/** Find best PM Web sheet within a workbook. Returns matched sheet name and header row index, or null. */
export function detectPmWeb(wb: XLSX.WorkBook): { sheetName: string; headerRowIndex: number } | null {
  let best: { sheetName: string; headerRowIndex: number; score: number } | null = null;
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const matrix = sheetToMatrix(ws);
    const limit = Math.min(matrix.length, 10);
    for (let r = 0; r < limit; r++) {
      const row = rowAsStrings(matrix[r] ?? []);
      const req = matchCount(row, PMWEB_REQUIRED);
      if (req < PMWEB_REQUIRED.length) continue;
      const score = req * 10 + matchCount(row, PMWEB_HELPFUL);
      if (!best || score > best.score) best = { sheetName, headerRowIndex: r, score };
    }
  }
  return best ? { sheetName: best.sheetName, headerRowIndex: best.headerRowIndex } : null;
}

/** Find K-Fasts trans detail sheet. Returns sheet name + machine-header row index. */
export function detectTrans(wb: XLSX.WorkBook): { sheetName: string; headerRowIndex: number } | null {
  let best: { sheetName: string; headerRowIndex: number; score: number } | null = null;
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const matrix = sheetToMatrix(ws);
    const limit = Math.min(matrix.length, 12);
    for (let r = 0; r < limit; r++) {
      const row = rowAsStrings(matrix[r] ?? []);
      const machine = matchCount(row, TRANS_TOKENS);
      if (machine >= 4) {
        const score = machine * 10;
        if (!best || score > best.score) best = { sheetName, headerRowIndex: r, score };
      } else {
        const labels = matchCount(row, TRANS_LABEL_TOKENS);
        if (labels >= 2) {
          const score = labels;
          if (!best || score > best.score) best = { sheetName, headerRowIndex: r, score };
        }
      }
    }
  }
  return best ? { sheetName: best.sheetName, headerRowIndex: best.headerRowIndex } : null;
}

export function detectFile(wb: XLSX.WorkBook): DetectionResult {
  const trans = detectTrans(wb);
  if (trans) {
    return {
      kind: "trans",
      sheetName: trans.sheetName,
      headerRowIndex: trans.headerRowIndex,
      label: "K-Fasts Proj Trans Detail",
    };
  }
  const pm = detectPmWeb(wb);
  if (pm) {
    return {
      kind: "all-data",
      sheetName: pm.sheetName,
      headerRowIndex: pm.headerRowIndex,
      label: "PM Web All-Data Export",
    };
  }
  return { kind: "unknown", sheetName: null, headerRowIndex: null, label: "Unknown file format" };
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array", cellDates: true, raw: true });
}

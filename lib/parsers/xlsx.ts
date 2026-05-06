import * as XLSX from "xlsx";
import { parseAllDataCsv, parseTransCsv } from "./csv";
import type { Matrix } from "./csv-detect";
import type { AllDataRow, TransRow } from "../types";

export type XlsxKind = "all-data" | "trans" | "unknown";

export type XlsxDetection = {
  kind: XlsxKind;
  /** Sheet selected from the workbook */
  sheetName: string | null;
  /** Header row index within the sheet matrix */
  headerRowIndex: number | null;
  /** Display label for the dialog */
  label: string;
};

const PM_WEB_REQUIRED = ["Project Number & Name", "Task Number & Name", "Total Fee", "JTD Hours"];
const TRANS_TOKENS = ["WBS2", "TaskName", "TransDate", "EmpVenUnitName", "HrsQty"];

function sheetToMatrix(ws: XLSX.WorkSheet): Matrix {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as unknown[][];
  return rows.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return "";
      if (cell instanceof Date) return cell.toISOString();
      return String(cell);
    }),
  );
}

function rowSet(row: string[]): Set<string> {
  return new Set(row.map((c) => (c ?? "").replace(/\s+/g, " ").trim()));
}

function findRowMatching(matrix: Matrix, tokens: string[], maxRow = 12): number {
  for (let r = 0; r < Math.min(matrix.length, maxRow); r++) {
    const set = rowSet(matrix[r] ?? []);
    if (tokens.every((t) => set.has(t))) return r;
  }
  return -1;
}

/** Inspect every sheet of a workbook to identify which file this is. */
export function detectXlsx(wb: XLSX.WorkBook): XlsxDetection {
  // K-Fasts trans first (more specific tokens)
  for (const sheetName of wb.SheetNames) {
    const matrix = sheetToMatrix(wb.Sheets[sheetName]);
    const r = findRowMatching(matrix, TRANS_TOKENS);
    if (r >= 0) {
      return {
        kind: "trans",
        sheetName,
        headerRowIndex: r,
        label: "K-Fasts Proj Trans Detail",
      };
    }
  }
  // PM Web all-data
  for (const sheetName of wb.SheetNames) {
    const matrix = sheetToMatrix(wb.Sheets[sheetName]);
    const r = findRowMatching(matrix, PM_WEB_REQUIRED);
    if (r >= 0) {
      return {
        kind: "all-data",
        sheetName,
        headerRowIndex: r,
        label: "PM Web All-Data Export",
      };
    }
  }
  return { kind: "unknown", sheetName: null, headerRowIndex: null, label: "Unknown workbook" };
}

export async function readXlsxFile(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array", cellDates: true, raw: true });
}

export function parseAllDataFromXlsx(
  wb: XLSX.WorkBook,
  detection: XlsxDetection,
): ReturnType<typeof parseAllDataCsv> {
  if (detection.kind !== "all-data" || !detection.sheetName) return null;
  const matrix = sheetToMatrix(wb.Sheets[detection.sheetName]);
  return parseAllDataCsv(matrix, detection.headerRowIndex!);
}

export function parseTransFromXlsx(
  wb: XLSX.WorkBook,
  detection: XlsxDetection,
): TransRow[] {
  if (detection.kind !== "trans" || !detection.sheetName) return [];
  const matrix = sheetToMatrix(wb.Sheets[detection.sheetName]);
  return parseTransCsv(matrix, detection.headerRowIndex!);
}

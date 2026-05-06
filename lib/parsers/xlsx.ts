import * as XLSX from "xlsx";
import {
  parseAllDataCsv,
  parseChangeLogCsv,
  parseCheckDetailCsv,
  parseEtcCsv,
  parseInvoiceLogCsv,
  parseInvoiceSummaryCsv,
  parseNotesCsv,
  parseStaffCsv,
  parseSubManagementCsv,
  parseTablesCsv,
  parseTaskBudgetCsv,
  parseTaskSummaryCsv,
  parseTransCsv,
} from "./csv";
import { detectCsv, type Matrix } from "./csv-detect";
import type {
  AllDataRow,
  ChangeLogRow,
  CheckDetailRow,
  CsvKind,
  ETCRow,
  InvoiceLogData,
  InvoiceSummaryRow,
  NotesData,
  StaffData,
  SubManagementData,
  TablesData,
  TaskBudgetRow,
  TaskSummaryRow,
  TransRow,
} from "../types";

/** Kept for backward compatibility — the upload dialog still calls these as the
 * "primary" parse for routing. */
export type XlsxKind = "all-data" | "trans" | "unknown";

export type XlsxDetection = {
  kind: XlsxKind;
  sheetName: string | null;
  headerRowIndex: number | null;
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

/**
 * Inspect every sheet and return the "primary" detection — used by the upload
 * dialog to label the file. K-Fasts trans wins over PM Web because the former
 * is a more specific (less common) match.
 */
export function detectXlsx(wb: XLSX.WorkBook): XlsxDetection {
  for (const sheetName of wb.SheetNames) {
    const matrix = sheetToMatrix(wb.Sheets[sheetName]);
    const r = findRowMatching(matrix, TRANS_TOKENS);
    if (r >= 0) {
      return { kind: "trans", sheetName, headerRowIndex: r, label: "K-Fasts Proj Trans Detail" };
    }
  }
  for (const sheetName of wb.SheetNames) {
    const matrix = sheetToMatrix(wb.Sheets[sheetName]);
    const r = findRowMatching(matrix, PM_WEB_REQUIRED);
    if (r >= 0) {
      return { kind: "all-data", sheetName, headerRowIndex: r, label: "PM Web All-Data Export" };
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

export function parseTransFromXlsx(wb: XLSX.WorkBook, detection: XlsxDetection): TransRow[] {
  if (detection.kind !== "trans" || !detection.sheetName) return [];
  const matrix = sheetToMatrix(wb.Sheets[detection.sheetName]);
  return parseTransCsv(matrix, detection.headerRowIndex!);
}

// ---------------------------------------------------------------------------
// Multi-sheet workbook ingestion
// ---------------------------------------------------------------------------

/** All datasets we may pull out of a single workbook. Any field is optional —
 * missing sheets simply return undefined, leaving the existing data intact. */
export type WorkbookExtraction = {
  allData?: { rows: AllDataRow[]; meta: NonNullable<ReturnType<typeof parseAllDataCsv>>["meta"] };
  trans?: TransRow[];
  invoiceSummary?: InvoiceSummaryRow[];
  taskSummary?: TaskSummaryRow[];
  taskBudget?: TaskBudgetRow[];
  etc?: ETCRow[];
  invoiceLog?: InvoiceLogData;
  changeLog?: ChangeLogRow[];
  subManagement?: SubManagementData;
  staff?: StaffData;
  notes?: NotesData;
  checkDetail?: CheckDetailRow[];
  tables?: TablesData;
  /** List of sheet names we successfully extracted, for upload-dialog feedback. */
  extracted: { sheet: string; kind: CsvKind | "all-data"; label: string }[];
  /** Sheets we couldn't classify — useful for diagnostics. */
  skipped: string[];
};

const KIND_LABELS: Record<CsvKind | "all-data", string> = {
  "all-data": "PM Web All-Data Export",
  trans: "K-Fasts Proj Trans Detail",
  "invoice-summary": "Invoice Summary",
  "task-summary": "Task Summary",
  "task-budget": "Task Budget",
  etc: "ETC (Estimate to Complete)",
  "invoice-log": "Invoice Log",
  "change-log": "Change Log",
  "sub-management": "Sub Management",
  staff: "Staff list",
  notes: "Project Notes",
  "check-detail": "Check Detail",
  tables: "Periods / Tasks lookup",
};

/** Walk every sheet, classify it, parse it, and accumulate a workbook extraction. */
export function extractWorkbook(wb: XLSX.WorkBook): WorkbookExtraction {
  const out: WorkbookExtraction = { extracted: [], skipped: [] };

  for (const sheetName of wb.SheetNames) {
    const matrix = sheetToMatrix(wb.Sheets[sheetName]);
    if (!matrix.length) {
      out.skipped.push(sheetName);
      continue;
    }

    // 1) PM Web All-Data — distinct header signature
    const allDataRow = findRowMatching(matrix, PM_WEB_REQUIRED);
    if (allDataRow >= 0) {
      const parsed = parseAllDataCsv(matrix, allDataRow);
      if (parsed) {
        out.allData = parsed;
        out.extracted.push({ sheet: sheetName, kind: "all-data", label: KIND_LABELS["all-data"] });
        continue;
      }
    }

    // 2) K-Fasts trans — distinct header signature
    const transRow = findRowMatching(matrix, TRANS_TOKENS);
    if (transRow >= 0) {
      out.trans = parseTransCsv(matrix, transRow);
      out.extracted.push({ sheet: sheetName, kind: "trans", label: KIND_LABELS["trans"] });
      continue;
    }

    // 3) Everything else — defer to detectCsv() over the matrix
    const det = detectCsv(matrix);
    if (det.kind === "unknown") {
      out.skipped.push(sheetName);
      continue;
    }

    try {
      switch (det.kind) {
        case "invoice-summary":
          if (det.headerRowIndex !== null)
            out.invoiceSummary = parseInvoiceSummaryCsv(matrix, det.headerRowIndex);
          break;
        case "task-summary":
          if (det.headerRowIndex !== null)
            out.taskSummary = parseTaskSummaryCsv(matrix, det.headerRowIndex);
          break;
        case "task-budget":
          if (det.headerRowIndex !== null)
            out.taskBudget = parseTaskBudgetCsv(matrix, det.headerRowIndex);
          break;
        case "etc":
          if (det.headerRowIndex !== null) out.etc = parseEtcCsv(matrix, det.headerRowIndex);
          break;
        case "invoice-log":
          if (det.headerRowIndex !== null)
            out.invoiceLog = parseInvoiceLogCsv(matrix, det.headerRowIndex);
          break;
        case "change-log":
          if (det.headerRowIndex !== null)
            out.changeLog = parseChangeLogCsv(matrix, det.headerRowIndex);
          break;
        case "sub-management":
          out.subManagement = parseSubManagementCsv(matrix);
          break;
        case "staff":
          out.staff = parseStaffCsv(matrix);
          break;
        case "notes":
          out.notes = parseNotesCsv(matrix);
          break;
        case "check-detail":
          if (det.headerRowIndex !== null)
            out.checkDetail = parseCheckDetailCsv(matrix, det.headerRowIndex);
          break;
        case "tables":
          out.tables = parseTablesCsv(matrix);
          break;
      }
      out.extracted.push({ sheet: sheetName, kind: det.kind, label: KIND_LABELS[det.kind] });
    } catch {
      out.skipped.push(sheetName);
    }
  }

  return out;
}

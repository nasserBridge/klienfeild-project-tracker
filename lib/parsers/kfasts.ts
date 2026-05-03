import * as XLSX from "xlsx";
import type { TransRow } from "../types";
import { safeNumber, toIsoDate } from "../utils";
import { detectTrans, sheetToMatrix } from "./detect";

/**
 * Map from human-label header → machine name.
 * If the detected header row uses human labels (e.g. "Transaction Date"),
 * we translate to the machine names so downstream code can use one schema.
 */
const HUMAN_TO_MACHINE: Record<string, string> = {
  "Transaction Date": "TransDate",
  "Employee, Vendor, or Unit Name": "EmpVenUnitName",
  "Hours or Qty": "HrsQty",
  "Non-Labor Cost": "NLCost",
  Rate: "Rate",
  "Bill Extension Amount": "BillAmt",
  "Activity or Non-Labor Group": "Activity",
  "Non-Labor Sub-Group": "BillTitle",
  "Labor Code Description": "InvDescription",
  "Billing Category": "Category",
  "Trans Type": "TransType",
  "Bill Status": "BillStatus",
  "Billed Inv Number": "BilledInvoice",
  "Labor Comment or Non-Labor Description": "CommentDesc",
  Period: "Period",
  "Post Seq": "PostSeq",
};

function buildIndex(headerRow: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  headerRow.forEach((h, i) => {
    if (h === null || h === undefined) return;
    const raw = String(h).trim();
    const machine = HUMAN_TO_MACHINE[raw];
    m.set(machine ?? raw, i);
  });
  return m;
}

function isLabor(category: string | null, employee: string | null): boolean {
  if (category && /^L-/i.test(category)) return true;
  // Fallback: if employee name has lowercase letters it's likely a person, not a vendor unit.
  if (employee && /[a-z]/.test(employee) && !/^[A-Z\s.,&]+$/.test(employee)) return true;
  return false;
}

function looksLikeDataRow(row: unknown[], idx: Map<string, number>): boolean {
  // First col is WBS2 (task code). Real data rows have a non-empty WBS2 that's NOT a label keyword.
  const wbs2 = idx.get("WBS2");
  if (wbs2 === undefined) return false;
  const v = row[wbs2];
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (!s) return false;
  // Skip header-like values
  if (/^(WBS2|Task|Number|Name)$/i.test(s)) return false;
  return true;
}

export function parseTrans(wb: XLSX.WorkBook): TransRow[] | null {
  const found = detectTrans(wb);
  if (!found) return null;
  const ws = wb.Sheets[found.sheetName];
  const matrix = sheetToMatrix(ws);
  const headerRow = matrix[found.headerRowIndex] ?? [];
  const idx = buildIndex(headerRow);

  // If the detected row contained human labels but no WBS2, look down a row or two for the machine row
  // and merge — this happens with the master tracker layout.
  if (!idx.has("WBS2")) {
    for (let r = found.headerRowIndex + 1; r < Math.min(matrix.length, found.headerRowIndex + 4); r++) {
      const candidate = matrix[r] ?? [];
      const candIdx = buildIndex(candidate);
      if (candIdx.has("WBS2") || candIdx.has("TransDate")) {
        for (const [k, v] of candIdx.entries()) idx.set(k, v);
        break;
      }
    }
  }

  const rows: TransRow[] = [];
  for (let r = found.headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    if (!looksLikeDataRow(raw, idx)) continue;
    const get = (k: string) => {
      const i = idx.get(k);
      return i === undefined ? null : raw[i];
    };
    const wbs2 = String(get("WBS2") ?? "").trim();
    const taskName = String(get("TaskName") ?? "").trim();
    const transDate = toIsoDate(get("TransDate"));
    if (!transDate) continue;
    const empVenUnitName = String(get("EmpVenUnitName") ?? "").trim();
    const category = get("Category");
    const categoryStr = category === null || category === undefined ? null : String(category).trim();
    rows.push({
      wbs2,
      taskName,
      transDate,
      empVenUnitName,
      hrsQty: safeNumber(get("HrsQty")),
      nlCost: safeNumber(get("NLCost")),
      rate: safeNumber(get("Rate")),
      billAmt: safeNumber(get("BillAmt")),
      activity: (() => {
        const v = get("Activity");
        return v === null || v === undefined ? null : String(v).trim();
      })(),
      billTitle: (() => {
        const v = get("BillTitle");
        return v === null || v === undefined ? null : String(v).trim();
      })(),
      invDescription: (() => {
        const v = get("InvDescription");
        return v === null || v === undefined ? null : String(v).trim();
      })(),
      category: categoryStr,
      transType: (() => {
        const v = get("TransType");
        return v === null || v === undefined ? null : String(v).trim();
      })(),
      billStatus: (() => {
        const v = get("BillStatus");
        return v === null || v === undefined ? null : String(v).trim();
      })(),
      billedInvoice: (() => {
        const v = get("BilledInvoice");
        return v === null || v === undefined ? null : String(v).trim();
      })(),
      commentDesc: (() => {
        const v = get("CommentDesc");
        return v === null || v === undefined ? null : String(v).trim();
      })(),
      period: (() => {
        const v = get("Period");
        return v === null || v === undefined ? null : String(v).trim();
      })(),
      postSeq: (() => {
        const v = get("PostSeq");
        if (v === null || v === undefined || v === "") return null;
        return safeNumber(v);
      })(),
      isLabor: isLabor(categoryStr, empVenUnitName),
    });
  }

  return rows;
}

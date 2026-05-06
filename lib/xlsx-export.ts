/**
 * Formatted XLSX export utilities.
 *
 * Builds workbook sheets with:
 *  - Typed cells (numbers stay numeric, dates stay dates) so Excel sums and sorts correctly
 *  - Number formats applied per column (money/percent/number/date)
 *  - Auto-sized column widths based on header + content
 *  - AutoFilter on the header row
 *  - Frozen header row via worksheet view
 *  - Optional total row visually separated from data
 *
 * Note: SheetJS Community Edition does not support cell styling (bold/fills),
 * so emphasis on the header / total row relies on number-format + structure
 * rather than fonts. The result still looks clean in Excel/Google Sheets.
 */
import * as XLSX from "xlsx";
import type {
  AllDataRow,
  ChangeLogRow,
  CheckDetailRow,
  ETCRow,
  InvoiceLogData,
  InvoiceSummaryRow,
  NotesData,
  ProjectMeta,
  StaffData,
  SubManagementData,
  TablesData,
  TaskBudgetRow,
  TaskSummaryRow,
  TransRow,
} from "./types";
import {
  periodLabelFromTables,
  revenueByPeriod,
  staffPivot,
  taskPivot,
} from "./calculations";

// ---- Column type metadata --------------------------------------------------

export type ColType =
  | "text"
  | "int"
  | "num1"
  | "num2"
  | "money0"
  | "money2"
  | "pct0"
  | "pct1"
  | "date";

export type ColDef = {
  /** Human-readable column header. */
  header: string;
  /** Property accessor — string key, or function returning the cell value. */
  key: string | ((row: any) => unknown);
  /** Column data type (controls number format and cell type). */
  type?: ColType;
  /** Optional explicit width (Excel character units). */
  width?: number;
};

const NUM_FORMAT: Record<Exclude<ColType, "text">, string> = {
  int: "#,##0",
  num1: "#,##0.0",
  num2: "#,##0.00",
  money0: '"$"#,##0;[Red]"$"\\-#,##0',
  money2: '"$"#,##0.00;[Red]"$"\\-#,##0.00',
  pct0: "0%",
  pct1: "0.0%",
  date: "yyyy-mm-dd",
};

// ---- Sheet builder --------------------------------------------------------

export type SheetSpec = {
  /** Sheet name — Excel limit is 31 chars, will be truncated. */
  name: string;
  columns: ColDef[];
  rows: any[];
  /** Optional total row appended below data (label cell + numeric totals). */
  total?: { label: string; values: Record<string, number | string> };
  /** Optional pre-rows before the header (e.g. a title or metadata block). */
  preamble?: (string | number | null)[][];
};

const dateFromIso = (iso: unknown): Date | null => {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const pickValue = (row: any, key: ColDef["key"]): unknown =>
  typeof key === "function" ? key(row) : row?.[key];

/**
 * Convert a value into an XLSX cell object respecting the column type.
 * Returns null/undefined for blanks so SheetJS leaves the cell empty.
 */
function toCell(value: unknown, type: ColType): XLSX.CellObject | null {
  if (value === null || value === undefined || value === "") return null;

  if (type === "date") {
    const d = value instanceof Date ? value : dateFromIso(value);
    if (!d) return null;
    return { t: "d", v: d, z: NUM_FORMAT.date };
  }

  if (type === "text") {
    return { t: "s", v: String(value) };
  }

  // Numeric types
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return value === "" ? null : { t: "s", v: String(value) };
  }
  return { t: "n", v: n, z: NUM_FORMAT[type] };
}

const SAFE_NAME_RE = /[\\/:*?"\[\]]/g;
const safeSheetName = (name: string): string =>
  name.replace(SAFE_NAME_RE, " ").slice(0, 31).trim() || "Sheet";

const colWidthFor = (col: ColDef, sampleValues: unknown[]): number => {
  if (col.width) return col.width;
  let max = col.header.length;
  // Sample only the first ~50 rows to keep this O(n) bounded.
  const limit = Math.min(50, sampleValues.length);
  for (let i = 0; i < limit; i++) {
    const v = sampleValues[i];
    if (v === null || v === undefined) continue;
    let s: string;
    if (col.type === "money2" || col.type === "money0") {
      s = `$${Math.round(Number(v) || 0).toLocaleString()}`;
    } else if (col.type === "pct0" || col.type === "pct1") {
      s = `${Math.round((Number(v) || 0) * 100)}%`;
    } else if (col.type === "date") {
      s = "yyyy-mm-dd";
    } else if (typeof v === "number") {
      s = v.toLocaleString();
    } else {
      s = String(v);
    }
    if (s.length > max) max = s.length;
  }
  // Cap to avoid one giant column blowing the layout.
  return Math.max(8, Math.min(48, max + 2));
};

/** Build a worksheet from a spec. */
export function buildSheet(spec: SheetSpec): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const cols = spec.columns;

  let rIdx = 0;

  // Preamble rows (raw text/numbers, no formatting)
  if (spec.preamble) {
    for (const pr of spec.preamble) {
      for (let c = 0; c < pr.length; c++) {
        const v = pr[c];
        if (v === null || v === undefined || v === "") continue;
        const addr = XLSX.utils.encode_cell({ r: rIdx, c });
        ws[addr] = typeof v === "number"
          ? { t: "n", v }
          : { t: "s", v: String(v) };
      }
      rIdx++;
    }
  }

  // Header
  const headerRow = rIdx;
  for (let c = 0; c < cols.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c });
    ws[addr] = { t: "s", v: cols[c].header };
  }
  rIdx++;

  // Data
  for (const row of spec.rows) {
    // Per-row type override — used by sheets where each row's "value" column
    // has a different type (e.g. the Summary metric/value layout).
    const rowType: ColType | undefined =
      row && typeof row === "object" && typeof (row as any).__type === "string"
        ? ((row as any).__type as ColType)
        : undefined;
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      const v = pickValue(row, col.key);
      // The override applies only to the column whose key starts with __value
      // (the typed-value column convention).
      const useRowType =
        rowType !== undefined &&
        typeof col.key === "string" &&
        col.key.startsWith("__value");
      const cell = toCell(v, useRowType ? rowType : col.type ?? "text");
      if (cell) {
        ws[XLSX.utils.encode_cell({ r: rIdx, c })] = cell;
      }
    }
    rIdx++;
  }
  const dataEnd = rIdx - 1;

  // Total row
  if (spec.total) {
    // Spacer row
    rIdx++;
    const totalRow = rIdx;
    ws[XLSX.utils.encode_cell({ r: totalRow, c: 0 })] = {
      t: "s",
      v: spec.total.label,
    };
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      if (typeof col.key !== "string") continue;
      if (!(col.key in spec.total.values)) continue;
      const v = spec.total.values[col.key];
      const cell = toCell(v, col.type ?? "text");
      if (cell) ws[XLSX.utils.encode_cell({ r: totalRow, c })] = cell;
    }
    rIdx++;
  }

  // Sheet range
  const lastCol = Math.max(0, cols.length - 1);
  const lastRow = Math.max(0, rIdx - 1);
  ws["!ref"] = XLSX.utils.encode_range(
    { r: 0, c: 0 },
    { r: lastRow, c: lastCol },
  );

  // Column widths (computed from sampled values)
  ws["!cols"] = cols.map((col) => {
    const samples = spec.rows.map((row) => pickValue(row, col.key));
    return { wch: colWidthFor(col, samples) };
  });

  // AutoFilter on header + data range
  if (spec.rows.length > 0) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range(
        { r: headerRow, c: 0 },
        { r: dataEnd, c: lastCol },
      ),
    };
  }

  // Freeze the header row (and any preamble lines above it)
  // SheetJS honors !views for pane freezing in xlsx writers.
  (ws as any)["!views"] = [
    { state: "frozen", ySplit: headerRow + 1, xSplit: 0 },
  ];

  return ws;
}

export type WorkbookBuilder = {
  wb: XLSX.WorkBook;
  /** Add a built sheet under a unique name (auto-deduped if needed). */
  add: (spec: SheetSpec) => void;
};

export function newWorkbook(): WorkbookBuilder {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  return {
    wb,
    add(spec) {
      let name = safeSheetName(spec.name);
      if (used.has(name)) {
        let n = 2;
        while (used.has(`${name.slice(0, 28)} ${n}`)) n++;
        name = `${name.slice(0, 28)} ${n}`;
      }
      used.add(name);
      const ws = buildSheet(spec);
      XLSX.utils.book_append_sheet(wb, ws, name);
    },
  };
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename, { bookType: "xlsx", compression: true });
}

// =============================================================================
// Per-tab sheet specs
// =============================================================================

export type TabKey =
  | "summary"
  | "task-summary"
  | "task-budget"
  | "etc"
  | "invoice-summary"
  | "invoice-log"
  | "hours-staff"
  | "hours-task"
  | "revenue"
  | "sub-management"
  | "staff"
  | "change-log"
  | "notes"
  | "transactions"
  | "check-detail";

export const TAB_LABELS: Record<TabKey, string> = {
  summary: "Summary",
  "task-summary": "Task Summary",
  "task-budget": "Task Budget",
  etc: "ETC",
  "invoice-summary": "Invoice Summary",
  "invoice-log": "Invoice Log",
  "hours-staff": "Hours by Staff",
  "hours-task": "Hours by Task",
  revenue: "Revenue by Period",
  "sub-management": "Sub Management",
  staff: "Staff",
  "change-log": "Change Log",
  notes: "Notes",
  transactions: "Transactions",
  "check-detail": "Check Detail",
};

export type ProjectBundle = {
  meta: ProjectMeta;
  allData: AllDataRow[];
  trans: TransRow[];
  invoiceSummary: InvoiceSummaryRow[];
  taskSummary: TaskSummaryRow[];
  taskBudget: TaskBudgetRow[];
  etc: ETCRow[];
  invoiceLog: InvoiceLogData | null;
  changeLog: ChangeLogRow[];
  subManagement: SubManagementData | null;
  staff: StaffData | null;
  notes: NotesData | null;
  checkDetail: CheckDetailRow[];
  tables: TablesData | null;
};

const sumNum = <T,>(rows: T[], pick: (r: T) => number): number =>
  rows.reduce((s, r) => s + (pick(r) || 0), 0);

// ---- Summary --------------------------------------------------------------

function summarySheet(b: ProjectBundle): SheetSpec | null {
  const total = b.allData.find((r) => r.isTotalRow);
  if (!total) return null;
  // Each row carries its own per-cell type via the `__type` field, picked up by
  // the column's function-key. The Value column declares text but we override
  // numerics by emitting them through the typed accessor below.
  type Row = { metric: string; value: unknown; type: ColType };
  const rows: Row[] = [
    { metric: "Project", value: b.meta.name, type: "text" },
    { metric: "Project ID", value: b.meta.id, type: "text" },
    { metric: "Project Manager", value: b.meta.pmName, type: "text" },
    { metric: "Start Date", value: total.startDate, type: "date" },
    { metric: "Est. Completion Date", value: total.estCompDate, type: "date" },
    { metric: "Total Fee", value: total.totalFee, type: "money2" },
    { metric: "JTD Net Revenue", value: total.netRev, type: "money2" },
    { metric: "Remaining", value: total.remainingTotalFee, type: "money2" },
    { metric: "% Revenue Taken", value: total.pctRevenueTaken, type: "pct1" },
    { metric: "JTD Hours", value: total.jtdHours, type: "num1" },
    { metric: "MTD Hours", value: total.mtdHours, type: "num1" },
    { metric: "Last Week Hours", value: total.lastWeekHrs, type: "num1" },
    { metric: "Profit %", value: total.profitPct, type: "pct1" },
    { metric: "GM %", value: total.gmPct, type: "pct1" },
    { metric: "Multiplier JTD", value: total.multiplierJtd, type: "num2" },
    { metric: "Target Multiplier JTD", value: total.targetMultiplierJtd, type: "num2" },
    { metric: "Status", value: total.status, type: "text" },
  ];
  // Build a sheet manually so each value cell takes its row's type.
  return {
    name: "Summary",
    columns: [
      { header: "Metric", key: "metric", type: "text", width: 28 },
      // The Value column type is irrelevant — buildSheet defers to the
      // per-row __type via the accessor when present.
      { header: "Value", key: "__value_typed" as any, type: "text", width: 28 },
    ],
    rows: rows.map((r) => ({
      metric: r.metric,
      // toCell receives a tagged tuple via __value_typed; column key path
      // returns the raw value, but we attach a per-row type override.
      __value_typed: r.value,
      __type: r.type,
    })),
    preamble: [
      [`${b.meta.name} — Summary`],
      [`Generated ${new Date().toLocaleString()}`],
      [],
    ],
  };
}

// ---- Task Summary ---------------------------------------------------------

function taskSummarySheet(rows: TaskSummaryRow[]): SheetSpec | null {
  if (!rows.length) return null;
  const total = {
    laborFee: sumNum(rows, (r) => r.laborFee),
    reimbursableFee: sumNum(rows, (r) => r.reimbursableFee),
    labFee: sumNum(rows, (r) => r.labFee),
    subFee: sumNum(rows, (r) => r.subFee),
    changeOrderAmt: sumNum(rows, (r) => r.changeOrderAmt),
    totalFee: sumNum(rows, (r) => r.totalFee),
    jtdRevenue: sumNum(rows, (r) => r.jtdRevenue),
    feeRemaining: sumNum(rows, (r) => r.feeRemaining),
    estimateToComp: sumNum(rows, (r) => r.estimateToComp),
    estimateAtComp: sumNum(rows, (r) => r.estimateAtComp),
    variance: sumNum(rows, (r) => r.variance),
  };
  return {
    name: "Task Summary",
    columns: [
      { header: "Sum Task", key: "sumTask", type: "text" },
      { header: "Description", key: "taskDescription", type: "text", width: 40 },
      { header: "Labor Fee", key: "laborFee", type: "money2" },
      { header: "Reimb. Fee", key: "reimbursableFee", type: "money2" },
      { header: "Lab Fee", key: "labFee", type: "money2" },
      { header: "Sub Fee", key: "subFee", type: "money2" },
      { header: "CO Amt", key: "changeOrderAmt", type: "money2" },
      { header: "Total Fee", key: "totalFee", type: "money2" },
      { header: "JTD Revenue", key: "jtdRevenue", type: "money2" },
      { header: "Remaining", key: "feeRemaining", type: "money2" },
      { header: "% Comp", key: "pctComplete", type: "pct1" },
      { header: "ETC", key: "estimateToComp", type: "money2" },
      { header: "EAC", key: "estimateAtComp", type: "money2" },
      { header: "Variance", key: "variance", type: "money2" },
      { header: "% Spent", key: "pctSpent", type: "pct1" },
      { header: "Start", key: "startDate", type: "date" },
      { header: "End", key: "endDate", type: "date" },
    ],
    rows,
    total: { label: "TOTAL", values: total },
  };
}

// ---- Task Budget (sub-task breakdown from PM Web) -------------------------

function taskBudgetSheet(allData: AllDataRow[]): SheetSpec | null {
  const tasks = allData.filter((r) => !r.isTotalRow && !r.isSummaryTask && r.taskCode);
  if (!tasks.length) return null;
  const total = allData.find((r) => r.isTotalRow);
  const rows = tasks.map((t) => ({
    taskCode: t.taskCode,
    taskName: t.taskName,
    totalFee: t.totalFee,
    laborFee: t.laborFee,
    consultFee: t.consultFee,
    reimbFee: t.reimbFee,
    netRev: t.netRev,
    remainingTotalFee: t.remainingTotalFee,
    jtdHours: t.jtdHours,
    laborCost: t.laborCost,
    pctRevenueTaken: t.pctRevenueTaken,
    status: t.status,
  }));
  return {
    name: "Task Budget",
    columns: [
      { header: "Code", key: "taskCode", type: "text" },
      { header: "Task", key: "taskName", type: "text", width: 40 },
      { header: "Total Fee", key: "totalFee", type: "money2" },
      { header: "Labor Fee", key: "laborFee", type: "money2" },
      { header: "Consult Fee", key: "consultFee", type: "money2" },
      { header: "Reimb. Fee", key: "reimbFee", type: "money2" },
      { header: "JTD Revenue", key: "netRev", type: "money2" },
      { header: "Remaining", key: "remainingTotalFee", type: "money2" },
      { header: "JTD Hrs", key: "jtdHours", type: "num1" },
      { header: "Labor Cost", key: "laborCost", type: "money2" },
      { header: "% Rev Taken", key: "pctRevenueTaken", type: "pct1" },
      { header: "Status", key: "status", type: "text" },
    ],
    rows,
    total: total
      ? {
          label: "TOTAL",
          values: {
            totalFee: total.totalFee,
            laborFee: total.laborFee,
            consultFee: total.consultFee,
            reimbFee: total.reimbFee,
            netRev: total.netRev,
            remainingTotalFee: total.remainingTotalFee,
            jtdHours: total.jtdHours,
            laborCost: total.laborCost,
            pctRevenueTaken: total.pctRevenueTaken,
          },
        }
      : undefined,
  };
}

// ---- ETC ------------------------------------------------------------------

function etcSheet(rows: ETCRow[]): SheetSpec | null {
  if (!rows.length) return null;
  const total = {
    budgetHrs: sumNum(rows, (r) => r.budgetHrs),
    actualsHrs: sumNum(rows, (r) => r.actualsHrs),
    etcHrs: sumNum(rows, (r) => r.etcHrs),
    budgetCost: sumNum(rows, (r) => r.budgetCost),
    actualCost: sumNum(rows, (r) => r.actualCost),
    etcCost: sumNum(rows, (r) => r.etcCost),
    eacCost: sumNum(rows, (r) => r.eacCost),
    vac: sumNum(rows, (r) => r.vac),
  };
  return {
    name: "ETC",
    columns: [
      { header: "Sum Task", key: "sumTask", type: "text" },
      { header: "Filter", key: "filter", type: "text" },
      { header: "Task", key: "task", type: "text" },
      { header: "Description", key: "taskDescription", type: "text", width: 36 },
      { header: "Staff", key: "staff", type: "text", width: 24 },
      { header: "Discipline", key: "discipline", type: "text" },
      { header: "Type", key: "type", type: "text" },
      { header: "Bill Rate", key: "billingRate", type: "money2" },
      { header: "Budget Hrs", key: "budgetHrs", type: "num1" },
      { header: "Actuals Hrs", key: "actualsHrs", type: "num1" },
      { header: "ETC Hrs", key: "etcHrs", type: "num1" },
      { header: "% Spent", key: "pctSpent", type: "pct1" },
      { header: "Budget $", key: "budgetCost", type: "money2" },
      { header: "Actual $", key: "actualCost", type: "money2" },
      { header: "ETC $", key: "etcCost", type: "money2" },
      { header: "EAC $", key: "eacCost", type: "money2" },
      { header: "VAC", key: "vac", type: "money2" },
    ],
    rows,
    total: { label: "TOTAL", values: total },
  };
}

// ---- Invoice Summary ------------------------------------------------------

function invoiceSummarySheet(rows: InvoiceSummaryRow[]): SheetSpec | null {
  if (!rows.length) return null;
  const enriched = rows.map((r) => ({
    ...r,
    remaining: r.totalFee - r.cumInvoiceToDate,
    outstanding: r.cumInvoiceToDate - r.paidToDate,
  }));
  const total = {
    totalFee: sumNum(enriched, (r) => r.totalFee),
    estCurrentInvoice: sumNum(enriched, (r) => r.estCurrentInvoice),
    cumInvoiceToDate: sumNum(enriched, (r) => r.cumInvoiceToDate),
    remaining: sumNum(enriched, (r) => r.remaining),
    jtdRevenue: sumNum(enriched, (r) => r.jtdRevenue),
    estimateAtComplete: sumNum(enriched, (r) => r.estimateAtComplete),
    paidToDate: sumNum(enriched, (r) => r.paidToDate),
    outstanding: sumNum(enriched, (r) => r.outstanding),
    arOver60: sumNum(enriched, (r) => r.arOver60),
  };
  return {
    name: "Invoice Summary",
    columns: [
      { header: "Task", key: "task", type: "text" },
      { header: "Description", key: "taskDescription", type: "text", width: 40 },
      { header: "Total Fee", key: "totalFee", type: "money2" },
      { header: "Est. Current Invoice", key: "estCurrentInvoice", type: "money2" },
      { header: "Cum Invoice To Date", key: "cumInvoiceToDate", type: "money2" },
      { header: "Remaining", key: "remaining", type: "money2" },
      { header: "JTD Revenue", key: "jtdRevenue", type: "money2" },
      { header: "EAC", key: "estimateAtComplete", type: "money2" },
      { header: "% Spent", key: "pctSpent", type: "pct1" },
      { header: "% Comp", key: "pctComp", type: "pct1" },
      { header: "Paid To Date", key: "paidToDate", type: "money2" },
      { header: "Outstanding", key: "outstanding", type: "money2" },
      { header: "AR Over 60", key: "arOver60", type: "money2" },
      { header: "NRM", key: "nrm", type: "num2" },
    ],
    rows: enriched,
    total: { label: "TOTAL", values: total },
  };
}

// ---- Invoice Log ----------------------------------------------------------

function invoiceLogSheet(data: InvoiceLogData | null): SheetSpec | null {
  if (!data || !data.rows.length) return null;
  const periods = data.periods;
  const periodCols: ColDef[] = periods.map((p) => ({
    header: p.label || p.date.slice(0, 7),
    key: (r: any) => r.byPeriod[p.date] ?? null,
    type: "money2",
  }));
  const rows = data.rows.map((r) => ({
    firm: r.firm,
    ntpDate: r.ntpDate,
    budget: r.budget,
    remainingBudget: r.remainingBudget,
    cumInvoice: r.cumInvoice,
    pctSpent: r.pctSpent,
    byPeriod: r.byPeriod,
  }));
  // Totals per period
  const periodTotals: Record<string, number> = {};
  for (const p of periods) {
    periodTotals[p.date] = sumNum(rows, (r) => r.byPeriod[p.date] ?? 0);
  }
  // Build totals values keyed by ColDef key — but period columns use functions.
  // Add each period total under a synthetic key matching its header so the
  // total row picks them up.
  const total: Record<string, number> = {
    budget: sumNum(rows, (r) => r.budget),
    remainingBudget: sumNum(rows, (r) => r.remainingBudget),
    cumInvoice: sumNum(rows, (r) => r.cumInvoice),
  };
  // For function-keyed period cols we need to swap to string keys with the
  // total-row-pickup pattern. Instead, append totals directly to rows[]?
  // Cleaner: rebuild period cols as string keys with a flat row shape.
  const flatRows = rows.map((r) => {
    const flat: any = {
      firm: r.firm,
      ntpDate: r.ntpDate,
      budget: r.budget,
      remainingBudget: r.remainingBudget,
      cumInvoice: r.cumInvoice,
      pctSpent: r.pctSpent,
    };
    for (const p of periods) {
      flat[`p_${p.date}`] = r.byPeriod[p.date] ?? null;
    }
    return flat;
  });
  const flatPeriodCols: ColDef[] = periods.map((p) => ({
    header: p.label || p.date.slice(0, 7),
    key: `p_${p.date}`,
    type: "money2" as const,
  }));
  for (const p of periods) total[`p_${p.date}`] = periodTotals[p.date];

  return {
    name: "Invoice Log",
    columns: [
      { header: "Firm", key: "firm", type: "text", width: 24 },
      { header: "NTP Date", key: "ntpDate", type: "date" },
      { header: "Budget", key: "budget", type: "money2" },
      { header: "Remaining", key: "remainingBudget", type: "money2" },
      { header: "Cum Invoice", key: "cumInvoice", type: "money2" },
      { header: "% Spent", key: "pctSpent", type: "pct1" },
      ...flatPeriodCols,
    ],
    rows: flatRows,
    total: { label: "TOTAL", values: total },
  };
}

// ---- Hours by Staff -------------------------------------------------------

function hoursByStaffSheet(trans: TransRow[]): SheetSpec | null {
  if (!trans.length) return null;
  const pivot = staffPivot(trans, "month", null);
  if (!pivot.rows.length) return null;
  const flatRows = pivot.rows.map((r) => {
    const flat: any = { employee: r.employee, total: r.total };
    for (const b of pivot.buckets) flat[`b_${b}`] = r.cells[b] ?? null;
    return flat;
  });
  const bucketCols: ColDef[] = pivot.buckets.map((b) => {
    const [y, m] = b.split("-");
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    return { header: label, key: `b_${b}`, type: "num1" as const };
  });
  const totalValues: Record<string, number> = { total: pivot.grandTotal };
  for (const b of pivot.buckets) totalValues[`b_${b}`] = pivot.bucketTotals[b] ?? 0;
  return {
    name: "Hours by Staff",
    columns: [
      { header: "Employee", key: "employee", type: "text", width: 28 },
      ...bucketCols,
      { header: "Total", key: "total", type: "num1" },
    ],
    rows: flatRows,
    total: { label: "TOTAL", values: totalValues },
  };
}

// ---- Hours by Task --------------------------------------------------------

function hoursByTaskSheet(trans: TransRow[]): SheetSpec | null {
  if (!trans.length) return null;
  const pivot = taskPivot(trans);
  if (!pivot.rows.length) return null;
  const flatRows = pivot.rows.map((r) => {
    const flat: any = {
      taskCode: r.taskCode,
      taskName: r.taskName,
      total: r.total,
    };
    for (const e of pivot.employees) flat[`e_${e}`] = r.cells[e] ?? null;
    return flat;
  });
  const empCols: ColDef[] = pivot.employees.map((e) => ({
    header: e,
    key: `e_${e}`,
    type: "num1" as const,
    width: 14,
  }));
  const totalValues: Record<string, number> = { total: pivot.grandTotal };
  for (const e of pivot.employees) totalValues[`e_${e}`] = pivot.empTotals[e] ?? 0;
  return {
    name: "Hours by Task",
    columns: [
      { header: "Task", key: "taskCode", type: "text" },
      { header: "Description", key: "taskName", type: "text", width: 40 },
      ...empCols,
      { header: "Total", key: "total", type: "num1" },
    ],
    rows: flatRows,
    total: { label: "TOTAL", values: totalValues },
  };
}

// ---- Revenue by Period ----------------------------------------------------

function revenueByPeriodSheet(trans: TransRow[], tables: TablesData | null): SheetSpec | null {
  if (!trans.length) return null;
  const data = revenueByPeriod(trans);
  if (!data.rows.length) return null;
  const labelFor = (period: string) =>
    tables ? periodLabelFromTables(period, tables.periods) : period;
  const rows = data.rows.map((r) => ({
    period: r.period,
    label: labelFor(r.period),
    revenue: r.revenue,
    cumulative: r.cumulative,
  }));
  return {
    name: "Revenue by Period",
    columns: [
      { header: "Period", key: "period", type: "text" },
      { header: "Label", key: "label", type: "text" },
      { header: "Revenue", key: "revenue", type: "money2" },
      { header: "Cumulative", key: "cumulative", type: "money2" },
    ],
    rows,
    total: { label: "TOTAL", values: { revenue: data.total } },
  };
}

// ---- Sub Management -------------------------------------------------------

function subManagementSheets(data: SubManagementData | null): SheetSpec[] {
  const out: SheetSpec[] = [];
  if (!data) return out;
  if (data.subs.length) {
    out.push({
      name: "Subs",
      columns: [
        { header: "Firm", key: "firm", type: "text" },
        { header: "Firm Name", key: "firmName", type: "text", width: 28 },
        { header: "Original Fee", key: "oriFee", type: "money2" },
        { header: "Mods", key: "mods", type: "money2" },
        { header: "Approved Fee", key: "approvedFee", type: "money2" },
        { header: "Invoiced", key: "invoicedToDate", type: "money2" },
        { header: "Remaining", key: "remaining", type: "money2" },
      ],
      rows: data.subs,
      total: {
        label: "TOTAL",
        values: {
          oriFee: sumNum(data.subs, (s) => s.oriFee),
          mods: sumNum(data.subs, (s) => s.mods),
          approvedFee: sumNum(data.subs, (s) => s.approvedFee),
          invoicedToDate: sumNum(data.subs, (s) => s.invoicedToDate),
          remaining: sumNum(data.subs, (s) => s.remaining),
        },
      },
    });
  }
  if (data.mods.length) {
    out.push({
      name: "Sub Mods",
      columns: [
        { header: "Firm", key: "firm", type: "text" },
        { header: "Original Fee", key: "oriFee", type: "money2" },
        { header: "Mod 01", key: "mod01", type: "money2" },
        { header: "Approved Date", key: "approvedDate", type: "date" },
      ],
      rows: data.mods,
    });
  }
  return out;
}

// ---- Staff ----------------------------------------------------------------

function staffSheet(data: StaffData | null): SheetSpec | null {
  if (!data || !data.rows.length) return null;
  return {
    name: "Staff",
    columns: [
      { header: "Firm", key: "firm", type: "text" },
      { header: "Type", key: "type", type: "text" },
      { header: "Discipline", key: "discipline", type: "text" },
      { header: "Name", key: "name", type: "text", width: 28 },
      { header: "Title", key: "title", type: "text", width: 28 },
      { header: "FY25 Rate", key: "fy25Rate", type: "money2" },
      { header: "FY26 Rate", key: "fy26Rate", type: "money2" },
    ],
    rows: data.rows,
    preamble:
      data.projectMultiplier !== null
        ? [[`Project Multiplier: ${data.projectMultiplier}`], []]
        : undefined,
  };
}

// ---- Change Log -----------------------------------------------------------

function changeLogSheet(rows: ChangeLogRow[]): SheetSpec | null {
  if (!rows.length) return null;
  return {
    name: "Change Log",
    columns: [
      { header: "No.", key: "changeNo", type: "text" },
      { header: "Description", key: "description", type: "text", width: 40 },
      { header: "Lead Contact", key: "leadContact", type: "text", width: 24 },
      { header: "Estimated Cost", key: "estimatedCost", type: "money2" },
      { header: "Days Delay", key: "estDaysDelay", type: "int" },
      { header: "Status", key: "status", type: "text" },
      { header: "Submitted", key: "submittedDate", type: "date" },
      { header: "Approved", key: "approvedDate", type: "date" },
    ],
    rows,
    total: {
      label: "TOTAL",
      values: {
        estimatedCost: sumNum(rows, (r) => r.estimatedCost),
        estDaysDelay: sumNum(rows, (r) => r.estDaysDelay),
      },
    },
  };
}

// ---- Notes ----------------------------------------------------------------

function notesSheet(data: NotesData | null): SheetSpec | null {
  if (!data) return null;
  const rows = Object.entries(data.fields).map(([field, value]) => ({ field, value }));
  if (data.freeform) rows.push({ field: "Notes", value: data.freeform });
  if (!rows.length) return null;
  return {
    name: "Notes",
    columns: [
      { header: "Field", key: "field", type: "text", width: 24 },
      { header: "Value", key: "value", type: "text", width: 60 },
    ],
    rows,
  };
}

// ---- Transactions ---------------------------------------------------------

function transactionsSheet(rows: TransRow[]): SheetSpec | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => b.transDate.localeCompare(a.transDate));
  return {
    name: "Transactions",
    columns: [
      { header: "Date", key: "transDate", type: "date" },
      { header: "WBS2", key: "wbs2", type: "text" },
      { header: "Task", key: "taskName", type: "text", width: 32 },
      { header: "Employee/Vendor", key: "empVenUnitName", type: "text", width: 24 },
      { header: "Hours", key: "hrsQty", type: "num2" },
      { header: "Rate", key: "rate", type: "money2" },
      { header: "Bill Amt", key: "billAmt", type: "money2" },
      { header: "NL Cost", key: "nlCost", type: "money2" },
      { header: "Activity", key: "activity", type: "text" },
      { header: "Bill Title", key: "billTitle", type: "text" },
      { header: "Inv Description", key: "invDescription", type: "text", width: 32 },
      { header: "Category", key: "category", type: "text" },
      { header: "Trans Type", key: "transType", type: "text" },
      { header: "Bill Status", key: "billStatus", type: "text" },
      { header: "Billed Invoice", key: "billedInvoice", type: "text" },
      { header: "Comment", key: "commentDesc", type: "text", width: 36 },
      { header: "Period", key: "period", type: "text" },
    ],
    rows: sorted,
    total: {
      label: "TOTAL",
      values: {
        hrsQty: sumNum(rows, (r) => r.hrsQty),
        billAmt: sumNum(rows, (r) => r.billAmt),
        nlCost: sumNum(rows, (r) => r.nlCost),
      },
    },
  };
}

// ---- Check Detail ---------------------------------------------------------

function checkDetailSheet(rows: CheckDetailRow[]): SheetSpec | null {
  if (!rows.length) return null;
  // Skip subtotal pivot rows (we recompute totals at the bottom).
  const data = rows.filter((r) => !r.isSubtotal);
  return {
    name: "Check Detail",
    columns: [
      { header: "WBS2", key: "wbs2", type: "text" },
      { header: "Task Name", key: "taskName", type: "text", width: 32 },
      { header: "Employee", key: "empVenUnitName", type: "text", width: 24 },
      { header: "Total Hours", key: "hrsQty", type: "num2" },
      { header: "Total Bill Amount", key: "billAmt", type: "money2" },
    ],
    rows: data,
    total: {
      label: "GRAND TOTAL",
      values: {
        hrsQty: sumNum(data, (r) => r.hrsQty),
        billAmt: sumNum(data, (r) => r.billAmt),
      },
    },
  };
}

// =============================================================================
// Public exports
// =============================================================================

/** Build a sheet spec for a single tab, or null if the tab has no data. */
export function specForTab(tab: TabKey, b: ProjectBundle): SheetSpec | SheetSpec[] | null {
  switch (tab) {
    case "summary":
      return summarySheet(b);
    case "task-summary":
      return taskSummarySheet(b.taskSummary);
    case "task-budget":
      return taskBudgetSheet(b.allData);
    case "etc":
      return etcSheet(b.etc);
    case "invoice-summary":
      return invoiceSummarySheet(b.invoiceSummary);
    case "invoice-log":
      return invoiceLogSheet(b.invoiceLog);
    case "hours-staff":
      return hoursByStaffSheet(b.trans);
    case "hours-task":
      return hoursByTaskSheet(b.trans);
    case "revenue":
      return revenueByPeriodSheet(b.trans, b.tables);
    case "sub-management":
      return subManagementSheets(b.subManagement);
    case "staff":
      return staffSheet(b.staff);
    case "change-log":
      return changeLogSheet(b.changeLog);
    case "notes":
      return notesSheet(b.notes);
    case "transactions":
      return transactionsSheet(b.trans);
    case "check-detail":
      return checkDetailSheet(b.checkDetail);
  }
}

const ALL_TABS: TabKey[] = [
  "summary",
  "task-summary",
  "task-budget",
  "etc",
  "invoice-summary",
  "invoice-log",
  "hours-staff",
  "hours-task",
  "revenue",
  "sub-management",
  "staff",
  "change-log",
  "notes",
  "transactions",
  "check-detail",
];

const baseFilename = (meta: ProjectMeta, suffix: string): string => {
  const slug = (meta.shortName || meta.id || "project").replace(/[^A-Za-z0-9_-]+/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}_${suffix}_${date}.xlsx`;
};

/** Export a single tab as a one-sheet workbook. */
export function exportTabToXlsx(tab: TabKey, b: ProjectBundle): boolean {
  const spec = specForTab(tab, b);
  const specs = !spec ? [] : Array.isArray(spec) ? spec : [spec];
  if (!specs.length) return false;
  const wb = newWorkbook();
  for (const s of specs) wb.add(s);
  downloadWorkbook(wb.wb, baseFilename(b.meta, slugify(TAB_LABELS[tab])));
  return true;
}

/** Export every tab that has data as separate sheets in one workbook. */
export function exportAllTabsToXlsx(b: ProjectBundle): void {
  const wb = newWorkbook();
  // Lead with a project metadata sheet
  wb.add({
    name: "Project Info",
    columns: [
      { header: "Field", key: "field", type: "text", width: 24 },
      { header: "Value", key: "value", type: "text", width: 40 },
    ],
    rows: [
      { field: "Project Name", value: b.meta.name },
      { field: "Short Name", value: b.meta.shortName },
      { field: "Project ID", value: b.meta.id },
      { field: "Project Manager", value: b.meta.pmName },
      { field: "Start Date", value: b.meta.startDate ?? "" },
      { field: "Est. Completion Date", value: b.meta.estCompDate ?? "" },
      { field: "Last Uploaded", value: b.meta.uploadedAt },
      { field: "Generated", value: new Date().toISOString() },
    ],
  });
  for (const tab of ALL_TABS) {
    const spec = specForTab(tab, b);
    if (!spec) continue;
    const specs = Array.isArray(spec) ? spec : [spec];
    for (const s of specs) wb.add(s);
  }
  downloadWorkbook(wb.wb, baseFilename(b.meta, "all"));
}

const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

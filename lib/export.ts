import JSZip from "jszip";
import Papa from "papaparse";
import { saveAs } from "file-saver";
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

type ProjectBundle = {
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

const csv = (rows: Record<string, unknown>[]): string =>
  rows.length ? Papa.unparse(rows) : "";

export function rowsToCsv(rows: unknown[][]): string {
  return Papa.unparse(rows as string[][]);
}

export async function exportProjectToZip(b: ProjectBundle) {
  const zip = new JSZip();

  if (b.allData.length) zip.file("pmweb_all_data_export.csv", csv(b.allData as unknown as Record<string, unknown>[]));
  if (b.trans.length) zip.file("kfasts_proj_trans_detail.csv", csv(b.trans as unknown as Record<string, unknown>[]));
  if (b.invoiceSummary.length) zip.file("invoice_summary.csv", csv(b.invoiceSummary as unknown as Record<string, unknown>[]));
  if (b.taskSummary.length) zip.file("task_summary.csv", csv(b.taskSummary as unknown as Record<string, unknown>[]));
  if (b.taskBudget.length) zip.file("task_budget.csv", csv(b.taskBudget as unknown as Record<string, unknown>[]));
  if (b.etc.length) zip.file("etc.csv", csv(b.etc as unknown as Record<string, unknown>[]));
  if (b.changeLog.length) zip.file("change_log.csv", csv(b.changeLog as unknown as Record<string, unknown>[]));
  if (b.checkDetail.length) zip.file("check_detail.csv", csv(b.checkDetail as unknown as Record<string, unknown>[]));

  if (b.invoiceLog) {
    const periods = b.invoiceLog.periods.map((p) => p.date);
    const rows = b.invoiceLog.rows.map((r) => {
      const obj: Record<string, unknown> = {
        Firm: r.firm,
        "NTP Date": r.ntpDate ?? "",
        Budget: r.budget,
        "Remaining Budget": r.remainingBudget,
        "Cum Invoice": r.cumInvoice,
        "% Spent": r.pctSpent,
      };
      for (const p of periods) obj[p] = r.byPeriod[p] ?? 0;
      return obj;
    });
    if (rows.length) zip.file("invoice_log.csv", csv(rows));
  }

  if (b.subManagement) {
    if (b.subManagement.subs.length)
      zip.file("sub_management.csv", csv(b.subManagement.subs as unknown as Record<string, unknown>[]));
    if (b.subManagement.mods.length)
      zip.file("sub_management_mods.csv", csv(b.subManagement.mods as unknown as Record<string, unknown>[]));
  }

  if (b.staff && b.staff.rows.length) {
    zip.file("staff.csv", csv(b.staff.rows as unknown as Record<string, unknown>[]));
  }

  if (b.notes) {
    const rows = [
      ...Object.entries(b.notes.fields).map(([k, v]) => [k, v]),
      ["", ""],
      ["Notes", b.notes.freeform],
    ];
    zip.file("notes.csv", rowsToCsv(rows));
  }

  if (b.tables) {
    const out: Record<string, unknown>[] = [];
    const max = Math.max(b.tables.periods.length, b.tables.tasks.length, b.tables.sumTasks.length);
    for (let i = 0; i < max; i++) {
      out.push({
        BilledPeriod: b.tables.periods[i]?.billedPeriod ?? "",
        Month: b.tables.periods[i]?.month ?? "",
        Year: b.tables.periods[i]?.year ?? "",
        Date: b.tables.periods[i]?.date ?? "",
        TaskNo: b.tables.tasks[i]?.taskNo ?? "",
        TaskDescription: b.tables.tasks[i]?.taskDescription ?? "",
        SumTaskCode: b.tables.sumTasks[i]?.sumTask ?? "",
        SummaryDescription: b.tables.sumTasks[i]?.summaryDescription ?? "",
      });
    }
    if (out.length) zip.file("tables.csv", csv(out));
  }

  // Manifest
  const manifest = {
    project: b.meta,
    generatedAt: new Date().toISOString(),
    files: Object.keys(zip.files),
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const fname = `${b.meta.id}_tracker_${new Date().toISOString().slice(0, 10)}.zip`;
  saveAs(blob, fname);
}

export function exportRowsToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const blob = new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, filename);
}

export function exportMatrixToCsv(filename: string, matrix: unknown[][]) {
  const blob = new Blob([Papa.unparse(matrix as string[][])], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, filename);
}

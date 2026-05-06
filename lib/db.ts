import Dexie, { type Table } from "dexie";
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

type Wrap<T> = { projectId: string; rows: T[] };

export class TrackerDB extends Dexie {
  projects!: Table<ProjectMeta, string>;
  allDataExport!: Table<Wrap<AllDataRow>, string>;
  projTransDetail!: Table<Wrap<TransRow>, string>;
  invoiceSummary!: Table<Wrap<InvoiceSummaryRow>, string>;
  taskSummary!: Table<Wrap<TaskSummaryRow>, string>;
  taskBudget!: Table<Wrap<TaskBudgetRow>, string>;
  etc!: Table<Wrap<ETCRow>, string>;
  invoiceLog!: Table<{ projectId: string; data: InvoiceLogData }, string>;
  changeLog!: Table<Wrap<ChangeLogRow>, string>;
  subManagement!: Table<{ projectId: string; data: SubManagementData }, string>;
  staff!: Table<{ projectId: string; data: StaffData }, string>;
  notes!: Table<{ projectId: string; data: NotesData }, string>;
  checkDetail!: Table<Wrap<CheckDetailRow>, string>;
  lookupTables!: Table<{ projectId: string; data: TablesData }, string>;

  constructor() {
    super("project-tracker");
    // v1 — original schema (kept for migration safety)
    this.version(1).stores({
      projects: "id, uploadedAt",
      allDataExport: "projectId",
      projTransDetail: "projectId",
    });
    // v2 — adds 11 new tables for the full master-tracker model
    this.version(2).stores({
      projects: "id, uploadedAt",
      allDataExport: "projectId",
      projTransDetail: "projectId",
      invoiceSummary: "projectId",
      taskSummary: "projectId",
      taskBudget: "projectId",
      etc: "projectId",
      invoiceLog: "projectId",
      changeLog: "projectId",
      subManagement: "projectId",
      staff: "projectId",
      notes: "projectId",
      checkDetail: "projectId",
      lookupTables: "projectId",
    });
  }
}

let _db: TrackerDB | null = null;
export function db(): TrackerDB {
  if (typeof window === "undefined") {
    throw new Error("DB only available in browser");
  }
  if (!_db) _db = new TrackerDB();
  return _db;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const all = await db().projects.toArray();
  return all.sort((a, b) => a.id.localeCompare(b.id));
}

export async function getProject(id: string) {
  return db().projects.get(id);
}

export async function upsertProject(meta: ProjectMeta) {
  await db().projects.put(meta);
}

export async function deleteProject(id: string) {
  const d = db();
  const allTables = [
    d.projects,
    d.allDataExport,
    d.projTransDetail,
    d.invoiceSummary,
    d.taskSummary,
    d.taskBudget,
    d.etc,
    d.invoiceLog,
    d.changeLog,
    d.subManagement,
    d.staff,
    d.notes,
    d.checkDetail,
    d.lookupTables,
  ];
  await d.transaction("rw", allTables, async () => {
    await Promise.all(allTables.map((t) => t.delete(id)));
  });
}

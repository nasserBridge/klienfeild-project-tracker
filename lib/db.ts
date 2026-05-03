import Dexie, { type Table } from "dexie";
import type { AllDataRow, ProjectMeta, TransRow } from "./types";

export type AllDataRecord = {
  projectId: string;
  rows: AllDataRow[];
};

export type TransRecord = {
  projectId: string;
  rows: TransRow[];
};

export class TrackerDB extends Dexie {
  projects!: Table<ProjectMeta, string>;
  allDataExport!: Table<AllDataRecord, string>;
  projTransDetail!: Table<TransRecord, string>;

  constructor() {
    super("project-tracker");
    this.version(1).stores({
      projects: "id, uploadedAt",
      allDataExport: "projectId",
      projTransDetail: "projectId",
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

export async function getProject(id: string): Promise<ProjectMeta | undefined> {
  return db().projects.get(id);
}

export async function getAllData(id: string): Promise<AllDataRow[]> {
  const r = await db().allDataExport.get(id);
  return r?.rows ?? [];
}

export async function getTrans(id: string): Promise<TransRow[]> {
  const r = await db().projTransDetail.get(id);
  return r?.rows ?? [];
}

export async function upsertProject(meta: ProjectMeta) {
  await db().projects.put(meta);
}

export async function saveAllData(projectId: string, rows: AllDataRow[]) {
  await db().allDataExport.put({ projectId, rows });
}

export async function saveTrans(projectId: string, rows: TransRow[]) {
  await db().projTransDetail.put({ projectId, rows });
}

export async function deleteProject(id: string) {
  await db().transaction(
    "rw",
    db().projects,
    db().allDataExport,
    db().projTransDetail,
    async () => {
      await db().projects.delete(id);
      await db().allDataExport.delete(id);
      await db().projTransDetail.delete(id);
    },
  );
}

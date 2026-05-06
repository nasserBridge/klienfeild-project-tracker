"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import {
  extractWorkbook,
  readXlsxFile,
  type WorkbookExtraction,
} from "@/lib/parsers/xlsx";
import { db, getProject, upsertProject } from "@/lib/db";
import type { CsvKind, ProjectMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

type Detected = {
  file: File;
  workbook: XLSX.WorkBook;
  extraction: WorkbookExtraction;
};

export function UploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState<Detected[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setItems([]);
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const onFiles = async (files: FileList | File[]) => {
    setError(null);
    const arr = Array.from(files).filter((f) => /\.xlsx$/i.test(f.name));
    const ignored = Array.from(files).filter((f) => !/\.xlsx$/i.test(f.name));
    if (arr.length === 0) {
      setError(
        ignored.length
          ? `Only .xlsx files are accepted. Ignored: ${ignored.map((f) => f.name).join(", ")}`
          : "No files were dropped.",
      );
      return;
    }
    const next: Detected[] = [];
    for (const file of arr) {
      try {
        const wb = await readXlsxFile(file);
        const extraction = extractWorkbook(wb);
        next.push({ file, workbook: wb, extraction });
      } catch (e) {
        next.push({
          file,
          workbook: { SheetNames: [], Sheets: {} } as unknown as XLSX.WorkBook,
          extraction: { extracted: [], skipped: [`Read error: ${(e as Error).message}`] },
        });
      }
    }
    // De-duplicate by file name so re-dropping replaces previous selection
    setItems((prev) => {
      const map = new Map<string, Detected>();
      for (const d of [...prev, ...next]) map.set(d.file.name, d);
      return [...map.values()];
    });
  };

  const removeItem = (name: string) => {
    setItems((prev) => prev.filter((d) => d.file.name !== name));
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void onFiles(e.dataTransfer.files);
  };

  // Merge all extractions across uploaded files. Later files take precedence
  // over earlier ones for the same kind — useful when the user drags both the
  // master tracker and a fresh PM Web export.
  const merged: WorkbookExtraction = React.useMemo(() => {
    const out: WorkbookExtraction = { extracted: [], skipped: [] };
    for (const it of items) {
      const e = it.extraction;
      if (e.allData) out.allData = e.allData;
      if (e.trans) out.trans = e.trans;
      if (e.invoiceSummary) out.invoiceSummary = e.invoiceSummary;
      if (e.taskSummary) out.taskSummary = e.taskSummary;
      if (e.taskBudget) out.taskBudget = e.taskBudget;
      if (e.etc) out.etc = e.etc;
      if (e.invoiceLog) out.invoiceLog = e.invoiceLog;
      if (e.changeLog) out.changeLog = e.changeLog;
      if (e.subManagement) out.subManagement = e.subManagement;
      if (e.staff) out.staff = e.staff;
      if (e.notes) out.notes = e.notes;
      if (e.checkDetail) out.checkDetail = e.checkDetail;
      if (e.tables) out.tables = e.tables;
      out.extracted.push(...e.extracted.map((x) => ({ ...x, sheet: `${it.file.name} › ${x.sheet}` })));
      out.skipped.push(...e.skipped.map((s) => `${it.file.name} › ${s}`));
    }
    return out;
  }, [items]);

  const canSave = merged.extracted.length > 0;

  const onSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const e = merged;

      let projectId: string | null = e.allData?.meta.id ?? null;
      let metaPatch: Partial<ProjectMeta> = {};

      if (e.allData) {
        metaPatch = {
          id: e.allData.meta.id,
          name: e.allData.meta.name,
          shortName: e.allData.meta.shortName,
          pmName: e.allData.meta.pmName,
          startDate: e.allData.meta.startDate,
          estCompDate: e.allData.meta.estCompDate,
        };
      }

      if (!projectId) {
        // Fall back to current path if no PM Web sheet was provided this round
        const pathProjectId = decodeURIComponent(window.location.pathname.split("/")[1] ?? "");
        if (pathProjectId) {
          const existing = await getProject(pathProjectId);
          if (existing) projectId = existing.id;
        }
      }
      if (!projectId) {
        throw new Error(
          "Add a PM Web All-Data Export at least once to register the project. " +
            "It can be the master tracker workbook or the standalone export.",
        );
      }

      const d = db();
      const uploaded = { ...((await getProject(projectId))?.uploaded ?? {}) } as Record<string, boolean>;

      if (e.allData) {
        await d.allDataExport.put({ projectId, rows: e.allData.rows });
        uploaded["all-data"] = true;
      }
      if (e.trans) {
        await d.projTransDetail.put({ projectId, rows: e.trans });
        uploaded["trans"] = true;
      }
      if (e.invoiceSummary) {
        await d.invoiceSummary.put({ projectId, rows: e.invoiceSummary });
        uploaded["invoice-summary"] = true;
      }
      if (e.taskSummary) {
        await d.taskSummary.put({ projectId, rows: e.taskSummary });
        uploaded["task-summary"] = true;
      }
      if (e.taskBudget) {
        await d.taskBudget.put({ projectId, rows: e.taskBudget });
        uploaded["task-budget"] = true;
      }
      if (e.etc) {
        await d.etc.put({ projectId, rows: e.etc });
        uploaded["etc"] = true;
      }
      if (e.invoiceLog) {
        await d.invoiceLog.put({ projectId, data: e.invoiceLog });
        uploaded["invoice-log"] = true;
      }
      if (e.changeLog) {
        await d.changeLog.put({ projectId, rows: e.changeLog });
        uploaded["change-log"] = true;
      }
      if (e.subManagement) {
        await d.subManagement.put({ projectId, data: e.subManagement });
        uploaded["sub-management"] = true;
      }
      if (e.staff) {
        await d.staff.put({ projectId, data: e.staff });
        uploaded["staff"] = true;
      }
      if (e.notes) {
        await d.notes.put({ projectId, data: e.notes });
        uploaded["notes"] = true;
      }
      if (e.checkDetail) {
        await d.checkDetail.put({ projectId, rows: e.checkDetail });
        uploaded["check-detail"] = true;
      }
      if (e.tables) {
        await d.lookupTables.put({ projectId, data: e.tables });
        uploaded["tables"] = true;
      }

      const existing = await getProject(projectId);
      await upsertProject({
        id: projectId,
        name: metaPatch.name ?? existing?.name ?? projectId,
        shortName: metaPatch.shortName ?? existing?.shortName ?? "",
        pmName: metaPatch.pmName ?? existing?.pmName ?? "",
        startDate: metaPatch.startDate ?? existing?.startDate ?? null,
        estCompDate: metaPatch.estCompDate ?? existing?.estCompDate ?? null,
        uploadedAt: new Date().toISOString(),
        uploaded: uploaded as Partial<Record<CsvKind, boolean>>,
      });

      onOpenChange(false);
      router.push(`/${encodeURIComponent(projectId)}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload project data</DialogTitle>
          <DialogDescription>
            Drop the master tracker workbook (every tab in one .xlsx), and/or the standalone PM Web
            All-Data Export and K-Fasts Proj Trans Detail files. Every sheet is detected by header
            structure and routed to the right tab automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "border border-dashed border-line rounded-md py-8 px-6 text-center transition-colors",
              dragOver && "border-accent bg-accent-tint",
            )}
          >
            <UploadCloud className="mx-auto text-muted mb-2" size={22} />
            <div className="text-sm text-ink">Drop .xlsx files here</div>
            <div className="text-xs text-muted mt-1">or</div>
            <label className="inline-block mt-2">
              <input
                type="file"
                accept=".xlsx"
                multiple
                className="sr-only"
                onChange={(e) => e.target.files && onFiles(e.target.files)}
              />
              <span className="inline-flex items-center justify-center text-xs px-3 py-1.5 border border-line rounded hover:bg-rowHover cursor-pointer">
                Browse files
              </span>
            </label>
          </div>

          {items.length > 0 && (
            <div className="mt-4 space-y-2 max-h-[260px] overflow-y-auto">
              {items.map((it) => (
                <div
                  key={it.file.name}
                  className="px-3 py-2 border border-line rounded bg-white"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet size={14} className="text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink truncate">{it.file.name}</div>
                      <div className="text-[11px] text-muted">
                        {it.extraction.extracted.length === 0
                          ? "No recognized sheets"
                          : `${it.extraction.extracted.length} sheet${
                              it.extraction.extracted.length === 1 ? "" : "s"
                            } detected`}
                      </div>
                    </div>
                    {it.extraction.extracted.length === 0 ? (
                      <AlertCircle size={14} className="text-bad" />
                    ) : (
                      <CheckCircle2 size={14} className="text-ok" />
                    )}
                    <button
                      onClick={() => removeItem(it.file.name)}
                      className="text-muted hover:text-ink p-0.5"
                      aria-label="Remove"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {it.extraction.extracted.length > 0 && (
                    <div className="mt-1.5 ml-6 flex flex-wrap gap-1">
                      {it.extraction.extracted.map((x, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[10px] tabular bg-[rgba(15,15,14,0.04)] text-muted px-1.5 py-0.5 rounded"
                          title={`Sheet: ${x.sheet}`}
                        >
                          {x.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-3 text-xs text-bad flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave || busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {busy
              ? "Saving…"
              : `Save ${merged.extracted.length} sheet${merged.extracted.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

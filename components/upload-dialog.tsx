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
  detectXlsx,
  parseAllDataFromXlsx,
  parseTransFromXlsx,
  readXlsxFile,
  type XlsxDetection,
  type XlsxKind,
} from "@/lib/parsers/xlsx";
import { db, getProject, upsertProject } from "@/lib/db";
import type { ProjectMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

type Detected = {
  file: File;
  workbook: XLSX.WorkBook;
  detection: XlsxDetection;
};

const KIND_LABEL: Record<XlsxKind, string> = {
  "all-data": "PM Web All-Data Export",
  trans: "K-Fasts Proj Trans Detail",
  unknown: "Unknown workbook",
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
        const det = detectXlsx(wb);
        next.push({ file, workbook: wb, detection: det });
      } catch (e) {
        next.push({
          file,
          workbook: { SheetNames: [], Sheets: {} } as unknown as XLSX.WorkBook,
          detection: { kind: "unknown", sheetName: null, headerRowIndex: null, label: `Read error: ${(e as Error).message}` },
        });
      }
    }
    // De-duplicate: one per kind (so re-dropping replaces previous selection)
    setItems((prev) => {
      const map = new Map<string, Detected>();
      for (const d of [...prev, ...next]) {
        const key = d.detection.kind === "unknown" ? `unknown:${d.file.name}` : d.detection.kind;
        map.set(key, d);
      }
      return [...map.values()];
    });
  };

  const removeItem = (key: string) => {
    setItems((prev) =>
      prev.filter((d) => (d.detection.kind === "unknown" ? `unknown:${d.file.name}` : d.detection.kind) !== key),
    );
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void onFiles(e.dataTransfer.files);
  };

  const allData = items.find((i) => i.detection.kind === "all-data");
  const trans = items.find((i) => i.detection.kind === "trans");
  const known = items.filter((i) => i.detection.kind !== "unknown");
  const canSave = !!(allData || trans);

  const onSave = async () => {
    setBusy(true);
    setError(null);
    try {
      let projectId: string | null = null;
      let metaPatch: Partial<ProjectMeta> = {};

      if (allData) {
        const parsed = parseAllDataFromXlsx(allData.workbook, allData.detection);
        if (!parsed) throw new Error("PM Web All-Data Export couldn't be parsed.");
        projectId = parsed.meta.id;
        metaPatch = {
          id: parsed.meta.id,
          name: parsed.meta.name,
          shortName: parsed.meta.shortName,
          pmName: parsed.meta.pmName,
          startDate: parsed.meta.startDate,
          estCompDate: parsed.meta.estCompDate,
        };
        await db().allDataExport.put({ projectId: parsed.meta.id, rows: parsed.rows });
      }

      if (!projectId) {
        // Try current path
        const pathProjectId = decodeURIComponent(window.location.pathname.split("/")[1] ?? "");
        if (pathProjectId) {
          const existing = await getProject(pathProjectId);
          if (existing) projectId = existing.id;
        }
      }
      if (!projectId) {
        throw new Error("Add a PM Web All-Data Export at least once to register the project.");
      }

      if (trans) {
        const transRows = parseTransFromXlsx(trans.workbook, trans.detection);
        await db().projTransDetail.put({ projectId, rows: transRows });
      }

      const existing = await getProject(projectId);
      const uploaded = { ...(existing?.uploaded ?? {}) };
      if (allData) uploaded["all-data"] = true;
      if (trans) uploaded["trans"] = true;

      await upsertProject({
        id: projectId,
        name: metaPatch.name ?? existing?.name ?? projectId,
        shortName: metaPatch.shortName ?? existing?.shortName ?? "",
        pmName: metaPatch.pmName ?? existing?.pmName ?? "",
        startDate: metaPatch.startDate ?? existing?.startDate ?? null,
        estCompDate: metaPatch.estCompDate ?? existing?.estCompDate ?? null,
        uploadedAt: new Date().toISOString(),
        uploaded,
      });

      onOpenChange(false);
      router.push(`/${encodeURIComponent(projectId)}`);
    } catch (e) {
      setError((e as Error).message);
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
            Drop the <strong>PM Web All-Data Export</strong> and the{" "}
            <strong>K-Fasts Proj Trans Detail</strong> as <code>.xlsx</code> files. Either or both.
            Detection is by header structure, not filename. Every other tab auto-populates from these
            two files — Notes, Change Log, Invoice Log, Sub Management, Staff and ETC are entered manually in-app.
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
            <div className="mt-4 space-y-1.5">
              {items.map((it) => {
                const key = it.detection.kind === "unknown" ? `unknown:${it.file.name}` : it.detection.kind;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 px-3 py-1.5 border border-line rounded bg-white"
                  >
                    <FileSpreadsheet size={14} className="text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink truncate">{it.file.name}</div>
                      <div className="text-[11px] text-muted">
                        {it.detection.kind === "unknown"
                          ? it.detection.label
                          : KIND_LABEL[it.detection.kind]}
                      </div>
                    </div>
                    {it.detection.kind === "unknown" ? (
                      <AlertCircle size={14} className="text-bad" />
                    ) : (
                      <CheckCircle2 size={14} className="text-ok" />
                    )}
                    <button
                      onClick={() => removeItem(key)}
                      className="text-muted hover:text-ink p-0.5"
                      aria-label="Remove"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
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
            {busy ? "Saving…" : `Save ${known.length} file${known.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

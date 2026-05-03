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
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { detectFile, readWorkbook } from "@/lib/parsers/detect";
import { parseAllData } from "@/lib/parsers/pmweb";
import { parseTrans } from "@/lib/parsers/kfasts";
import { saveAllData, saveTrans, upsertProject, getProject } from "@/lib/db";
import { cn } from "@/lib/utils";

type Detected = {
  file: File;
  kind: "all-data" | "trans" | "unknown";
  label: string;
  error?: string;
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
    if (arr.length === 0) {
      setError("Please drop .xlsx files only.");
      return;
    }
    const next: Detected[] = [];
    for (const file of arr) {
      try {
        const wb = await readWorkbook(file);
        const det = detectFile(wb);
        next.push({ file, kind: det.kind, label: det.label });
      } catch (e) {
        next.push({
          file,
          kind: "unknown",
          label: "Unable to read",
          error: (e as Error).message,
        });
      }
    }
    setItems((prev) => mergeDetections(prev, next));
  };

  const mergeDetections = (prev: Detected[], next: Detected[]): Detected[] => {
    const map = new Map<string, Detected>();
    for (const d of [...prev, ...next]) {
      // Keep one per kind; later overwrites earlier
      map.set(d.kind, d);
    }
    return [...map.values()];
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void onFiles(e.dataTransfer.files);
  };

  const allData = items.find((i) => i.kind === "all-data");
  const trans = items.find((i) => i.kind === "trans");
  const canSave = !!(allData || trans);

  const onSave = async () => {
    setBusy(true);
    setError(null);
    try {
      let projectId: string | null = null;
      let projectName = "";
      let pmName = "";
      let startDate: string | null = null;
      let estCompDate: string | null = null;
      let shortName = "";
      let allDataParsed = false;

      if (allData) {
        const wb = await readWorkbook(allData.file);
        const parsed = parseAllData(wb);
        if (!parsed) throw new Error("Could not parse PM Web export — headers not detected.");
        projectId = parsed.meta.id;
        projectName = parsed.meta.name;
        pmName = parsed.meta.pmName;
        startDate = parsed.meta.startDate;
        estCompDate = parsed.meta.estCompDate;
        shortName = parsed.meta.shortName;
        await saveAllData(projectId, parsed.rows);
        allDataParsed = true;
      }

      let transRowsCount = 0;
      let parsedTrans: Awaited<ReturnType<typeof parseTrans>> = null;
      if (trans) {
        const wb = await readWorkbook(trans.file);
        parsedTrans = parseTrans(wb);
        if (!parsedTrans) throw new Error("Could not parse Proj Trans Detail — headers not detected.");
        transRowsCount = parsedTrans.length;
      }

      // If we don't have a projectId from PM Web, use existing project's id (if user is re-uploading
      // just the trans file) — pull project id from URL.
      if (!projectId) {
        const pathProjectId = window.location.pathname.split("/")[1];
        if (pathProjectId) {
          const existing = await getProject(pathProjectId);
          if (existing) {
            projectId = existing.id;
            projectName = existing.name;
            pmName = existing.pmName;
            startDate = existing.startDate;
            estCompDate = existing.estCompDate;
            shortName = existing.shortName;
          }
        }
      }
      if (!projectId) throw new Error("Add a PM Web export first to register the project.");

      if (parsedTrans) {
        await saveTrans(projectId, parsedTrans);
      }

      const existing = await getProject(projectId);
      await upsertProject({
        id: projectId,
        name: projectName || existing?.name || projectId,
        shortName: shortName || existing?.shortName || "",
        pmName: pmName || existing?.pmName || "",
        startDate: startDate ?? existing?.startDate ?? null,
        estCompDate: estCompDate ?? existing?.estCompDate ?? null,
        uploadedAt: new Date().toISOString(),
        hasAllData: allDataParsed || existing?.hasAllData || false,
        hasTrans: transRowsCount > 0 || existing?.hasTrans || false,
      });

      onOpenChange(false);
      router.push(`/${projectId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add project data</DialogTitle>
          <DialogDescription>
            Drop the PM Web All-Data Export and the K-Fasts Proj Trans Detail. Either or both. Files are detected by their column structure, not by name.
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
              "border border-dashed border-line rounded-md py-10 px-6 text-center transition-colors",
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
            <div className="mt-4 space-y-2">
              {items.map((it) => (
                <div
                  key={`${it.kind}-${it.file.name}`}
                  className="flex items-center gap-3 px-3 py-2 border border-line rounded bg-white"
                >
                  <FileSpreadsheet size={16} className="text-muted" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink truncate">{it.file.name}</div>
                    <div className="text-xs text-muted">
                      Detected: {it.kind === "unknown" ? "Unknown format" : it.label}
                    </div>
                  </div>
                  {it.kind === "unknown" ? (
                    <AlertCircle size={16} className="text-bad" />
                  ) : (
                    <CheckCircle2 size={16} className="text-ok" />
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-3 text-xs text-bad flex items-center gap-1.5">
              <AlertCircle size={12} /> {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave || busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

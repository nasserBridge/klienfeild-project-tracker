"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteProject } from "@/lib/db";
import { MoreHorizontal, Plus, Folder } from "lucide-react";
import { cn, fmtDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UploadDialog } from "@/components/upload-dialog";

export function Sidebar() {
  const params = useParams();
  const router = useRouter();
  const activeId = (params?.projectId as string | undefined) ?? null;

  const projects = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    const all = await db().projects.toArray();
    return all.sort((a, b) => a.id.localeCompare(b.id));
  }, []);

  const [uploadOpen, setUploadOpen] = React.useState(false);

  // Cmd/Ctrl+U: open upload
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u") {
        e.preventDefault();
        setUploadOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <aside className="w-[240px] shrink-0 h-screen sticky top-0 bg-bg border-r border-line flex flex-col">
      <div className="px-4 pt-5 pb-3">
        <div className="mb-4">
          <Image
            src="/logo.png"
            alt="Kleinfelder"
            width={148}
            height={48}
            className="object-contain object-left"
            priority
          />
        </div>
        <Button onClick={() => setUploadOpen(true)} className="w-full" size="sm" variant="outline">
          <Plus size={14} /> Add project
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        {projects === undefined && <div className="px-3 py-4 text-xs text-muted">Loading…</div>}
        {projects && projects.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted">No projects yet.</div>
        )}
        {projects?.map((p) => (
          <div
            key={p.id}
            className={cn(
              "group relative flex items-center pr-1 rounded transition-colors",
              activeId === p.id ? "bg-accent-tint" : "hover:bg-rowHover",
            )}
          >
            {activeId === p.id && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-accent rounded-full" />
            )}
            <Link
              href={`/${p.id}`}
              className="flex-1 min-w-0 px-3 py-2 text-left"
              prefetch={false}
            >
              <div className="tabular text-[13px] text-ink leading-tight truncate">{p.id}</div>
              <div className="text-[11px] text-muted leading-tight truncate mt-0.5">
                {p.shortName || "—"}
              </div>
              <div className="text-[10px] text-muted/70 mt-0.5">{fmtDateTime(p.uploadedAt)}</div>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted hover:text-ink hover:bg-rowHover"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Project options"
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setUploadOpen(true);
                  }}
                >
                  Re-upload data…
                </DropdownMenuItem>
                <DropdownMenuItem
                  destructive
                  onClick={async () => {
                    const ok = window.confirm(`Delete project ${p.id}? This cannot be undone.`);
                    if (!ok) return;
                    await deleteProject(p.id);
                    if (activeId === p.id) router.push("/");
                  }}
                >
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-4 py-3 text-[11px] text-muted flex items-center gap-2">
        <Folder size={12} /> Local data (IndexedDB)
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </aside>
  );
}

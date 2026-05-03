"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { UploadDialog } from "@/components/upload-dialog";

export default function Home() {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const projects = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    const all = await db().projects.toArray();
    return all.sort((a, b) => a.id.localeCompare(b.id));
  }, []);

  // If projects exist, redirect to the first one once on mount
  React.useEffect(() => {
    if (projects && projects.length > 0) {
      router.replace(`/${projects[0].id}`);
    }
  }, [projects, router]);

  if (projects === undefined) return null;
  if (projects.length > 0) return null;

  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="text-center max-w-md">
        <div className="serif text-3xl mb-3">No projects yet</div>
        <p className="text-sm text-muted mb-6">
          Add a PM Web All-Data Export and a K-Fasts Proj Trans Detail to get started. Files are
          parsed locally and stored in your browser.
        </p>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus size={14} /> Add your first project
        </Button>
      </div>
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}

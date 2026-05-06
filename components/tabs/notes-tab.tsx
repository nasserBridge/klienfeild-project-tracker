"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import type { NotesData } from "@/lib/types";

const FIELDS: { key: string; label: string }[] = [
  { key: "Project Name", label: "Project Name" },
  { key: "Project Manager", label: "Project Manager" },
  { key: "Provisional PM", label: "Provisional PM" },
  { key: "Technical Lead", label: "Technical Lead" },
  { key: "Risk Register", label: "Risk Register" },
  { key: "Safety", label: "Safety" },
  { key: "APM", label: "APM" },
  { key: "Lead PCS", label: "Lead PCS" },
  { key: "Accountant", label: "Accountant" },
  { key: "Sub Management", label: "Sub Management" },
  { key: "Prevailing Wage", label: "Prevailing Wage" },
  { key: "DIR Project No.", label: "DIR Project No." },
  { key: "WC", label: "WC" },
  { key: "RFP Date", label: "RFP Date" },
  { key: "Dir Determination", label: "Dir Determination" },
  { key: "PLA", label: "PLA" },
];

function emptyData(): NotesData {
  const fields: Record<string, string> = {};
  for (const f of FIELDS) fields[f.key] = "";
  return { fields, freeform: "" };
}

export function NotesTab({ projectId, data }: { projectId: string; data: NotesData | null }) {
  const initial = data ?? emptyData();
  const [fields, setFields] = React.useState<Record<string, string>>({ ...initial.fields });
  const [freeform, setFreeform] = React.useState(initial.freeform);

  // Re-sync if a different project is loaded.
  React.useEffect(() => {
    setFields({ ...initial.fields });
    setFreeform(initial.freeform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, data]);

  async function persist(next: NotesData) {
    await db().notes.put({ projectId, data: next });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Project info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <label
                  htmlFor={`f-${f.key}`}
                  className="w-[140px] shrink-0 text-[11px] uppercase tracking-wider text-muted text-right"
                >
                  {f.label}
                </label>
                <Input
                  id={`f-${f.key}`}
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))}
                  onBlur={() => persist({ fields, freeform })}
                  className="h-8 text-[13px]"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={freeform}
            onChange={(e) => setFreeform(e.target.value)}
            onBlur={() => persist({ fields, freeform })}
            placeholder="Free-form notes — saves on blur."
            rows={10}
            className="w-full text-sm bg-white border border-line rounded-md p-3 focus:outline-none focus:border-lineStrong"
          />
        </CardContent>
      </Card>
    </div>
  );
}

"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import type { ChangeLogRow } from "@/lib/types";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/utils";
import { Plus, Trash2, Check, X } from "lucide-react";

type Status = "Pending" | "Approved" | "Rejected";

const STATUS_STYLES: Record<Status, string> = {
  Pending: "bg-[rgba(176,112,32,0.1)] text-warn",
  Approved: "bg-[rgba(45,106,79,0.1)] text-ok",
  Rejected: "bg-[rgba(176,48,32,0.1)] text-bad",
};

function badge(status: string): React.ReactNode {
  const norm = (status || "").trim();
  const style =
    norm === "Approved"
      ? STATUS_STYLES.Approved
      : norm === "Rejected"
      ? STATUS_STYLES.Rejected
      : norm
      ? STATUS_STYLES.Pending
      : "";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded ${style}`}>
      {norm || "—"}
    </span>
  );
}

export function ChangeLogTab({ projectId, rows }: { projectId: string; rows: ChangeLogRow[] }) {
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState<ChangeLogRow>(emptyDraft());

  function emptyDraft(): ChangeLogRow {
    return {
      changeNo: "",
      description: "",
      leadContact: "",
      estimatedCost: 0,
      estDaysDelay: 0,
      status: "Pending",
      submittedDate: null,
      approvedDate: null,
    };
  }

  async function save(newRows: ChangeLogRow[]) {
    await db().changeLog.put({ projectId, rows: newRows });
  }

  async function commitAdd() {
    if (!draft.changeNo.trim() && !draft.description.trim()) {
      setAdding(false);
      return;
    }
    await save([draft, ...rows]);
    setDraft(emptyDraft());
    setAdding(false);
  }

  async function deleteRow(index: number) {
    const ok = window.confirm("Delete this change?");
    if (!ok) return;
    const next = rows.filter((_, i) => i !== index);
    await save(next);
  }

  const totals = rows.reduce(
    (a, r) => ({ cost: a.cost + r.estimatedCost, days: a.days + r.estDaysDelay }),
    { cost: 0, days: 0 },
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">{fmtNum(rows.length)} changes</div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} /> Add change
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgba(15,15,14,0.02)]">
              <tr>
                <Th>No.</Th>
                <Th>Description</Th>
                <Th>Lead Contact</Th>
                <Th right>Cost</Th>
                <Th right>Days Delay</Th>
                <Th>Status</Th>
                <Th>Submitted</Th>
                <Th>Approved</Th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {adding && (
                <tr className="bg-accent-tint border-b border-line">
                  <td className="px-2 py-1.5">
                    <Input
                      autoFocus
                      value={draft.changeNo}
                      onChange={(e) => setDraft({ ...draft, changeNo: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="01"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="Description…"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={draft.leadContact}
                      onChange={(e) => setDraft({ ...draft, leadContact: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={draft.estimatedCost || ""}
                      onChange={(e) => setDraft({ ...draft, estimatedCost: Number(e.target.value) || 0 })}
                      className="h-7 text-xs text-right tabular"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={draft.estDaysDelay || ""}
                      onChange={(e) => setDraft({ ...draft, estDaysDelay: Number(e.target.value) || 0 })}
                      className="h-7 text-xs text-right tabular"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className="h-7 text-xs border border-line rounded px-1 bg-white w-full"
                      value={draft.status}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                    >
                      <option>Pending</option>
                      <option>Approved</option>
                      <option>Rejected</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="date"
                      value={draft.submittedDate?.slice(0, 10) ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          submittedDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="date"
                      value={draft.approvedDate?.slice(0, 10) ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          approvedDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5 flex gap-1">
                    <button onClick={commitAdd} className="text-ok hover:bg-rowHover p-1 rounded">
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => {
                        setAdding(false);
                        setDraft(emptyDraft());
                      }}
                      className="text-muted hover:text-ink hover:bg-rowHover p-1 rounded"
                    >
                      <X size={13} />
                    </button>
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line/60 hover:bg-rowHover">
                  <td className="px-3 py-1.5 tabular text-[12px]">{r.changeNo || "—"}</td>
                  <td className="px-3 py-1.5 text-[12px] max-w-[300px] truncate" title={r.description}>
                    {r.description || "—"}
                  </td>
                  <td className="px-3 py-1.5 text-[12px]">{r.leadContact || "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">
                    {r.estimatedCost ? fmtMoney(r.estimatedCost) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">
                    {r.estDaysDelay || "—"}
                  </td>
                  <td className="px-3 py-1.5">{badge(r.status)}</td>
                  <td className="px-3 py-1.5 text-[11px]">{fmtDate(r.submittedDate)}</td>
                  <td className="px-3 py-1.5 text-[11px]">{fmtDate(r.approvedDate)}</td>
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() => deleteRow(i)}
                      className="text-muted hover:text-bad hover:bg-rowHover p-1 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {!adding && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-xs text-muted">
                    No changes yet. Click "Add change" to track one.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-white border-t border-lineStrong">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-[12px] font-medium">Total</td>
                <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(totals.cost)}</td>
                <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{totals.days}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={
        "px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium whitespace-nowrap " +
        (right ? "text-right" : "text-left")
      }
    >
      {children}
    </th>
  );
}

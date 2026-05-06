"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import type { StaffData, StaffRow, TransRow } from "@/lib/types";
import { fmtMoney, fmtNum } from "@/lib/utils";
import { Plus, RefreshCw, Search, Trash2 } from "lucide-react";

function emptyData(): StaffData {
  return { rows: [], projectMultiplier: null };
}

export function StaffTab({
  projectId,
  data,
  trans,
}: {
  projectId: string;
  data: StaffData | null;
  trans: TransRow[];
}) {
  const current = data ?? emptyData();
  const [firmFilter, setFirmFilter] = React.useState<string>("__all");
  const [discFilter, setDiscFilter] = React.useState<string>("__all");
  const [search, setSearch] = React.useState("");

  const persist = React.useCallback(
    async (next: StaffData) => {
      await db().staff.put({ projectId, data: next });
    },
    [projectId],
  );

  const update = (i: number, patch: Partial<StaffRow>) => {
    const rows = current.rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    persist({ ...current, rows });
  };
  const remove = (i: number) => {
    if (!confirm("Remove this staff row?")) return;
    persist({ ...current, rows: current.rows.filter((_, j) => j !== i) });
  };
  const addRow = () => {
    persist({
      ...current,
      rows: [
        ...current.rows,
        { firm: "01-KLF", type: "Labor", discipline: "", name: "", title: "", fy25Rate: 0, fy26Rate: 0 },
      ],
    });
  };

  /** Auto-import unique labor employees from K-Fasts; uses average bill rate. */
  const autoPopulate = async () => {
    const byEmp = new Map<string, { totalBill: number; totalHrs: number; title: string }>();
    for (const t of trans) {
      if (!t.isLabor) continue;
      if (!byEmp.has(t.empVenUnitName))
        byEmp.set(t.empVenUnitName, { totalBill: 0, totalHrs: 0, title: t.billTitle ?? "" });
      const e = byEmp.get(t.empVenUnitName)!;
      e.totalBill += t.billAmt;
      e.totalHrs += t.hrsQty;
      if (!e.title && t.billTitle) e.title = t.billTitle;
    }
    const existing = new Set(current.rows.map((r) => r.name));
    const additions: StaffRow[] = [];
    for (const [name, info] of byEmp.entries()) {
      if (existing.has(name)) continue;
      const avgRate = info.totalHrs > 0 ? info.totalBill / info.totalHrs : 0;
      additions.push({
        firm: "01-KLF",
        type: "Labor",
        discipline: "",
        name,
        title: info.title,
        fy25Rate: avgRate,
        fy26Rate: avgRate,
      });
    }
    if (!additions.length) {
      alert("All K-Fasts labor employees are already in the staff list.");
      return;
    }
    persist({ ...current, rows: [...current.rows, ...additions] });
  };

  const filtered = current.rows.filter((r) => {
    if (firmFilter !== "__all" && r.firm !== firmFilter) return false;
    if (discFilter !== "__all" && r.discipline !== discFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${r.name} ${r.title}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const firms = [...new Set(current.rows.map((r) => r.firm).filter(Boolean))].sort();
  const disciplines = [...new Set(current.rows.map((r) => r.discipline).filter(Boolean))].sort();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select className="h-8 border border-line rounded px-2 text-xs bg-white" value={firmFilter} onChange={(e) => setFirmFilter(e.target.value)}>
          <option value="__all">All firms</option>
          {firms.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select className="h-8 border border-line rounded px-2 text-xs bg-white" value={discFilter} onChange={(e) => setDiscFilter(e.target.value)}>
          <option value="__all">All disciplines</option>
          {disciplines.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div className="relative w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={13} />
          <Input
            placeholder="Search name or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={autoPopulate} disabled={trans.length === 0}>
            <RefreshCw size={13} /> Auto-import from K-Fasts
          </Button>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus size={13} /> Add staff
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted">
        {fmtNum(filtered.length)} of {fmtNum(current.rows.length)}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgba(15,15,14,0.02)]">
              <tr>
                <Th>Firm</Th>
                <Th>Type</Th>
                <Th>Discipline</Th>
                <Th>Name</Th>
                <Th>Title</Th>
                <Th right>FY25 Rate</Th>
                <Th right>FY26 Rate</Th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted">
                    No staff yet — click "Auto-import from K-Fasts" or "Add staff".
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const i = current.rows.indexOf(r);
                return (
                  <tr key={i} className="border-b border-line/60">
                    <Cell>
                      <Input value={r.firm} onChange={(e) => update(i, { firm: e.target.value })} className="h-7 text-[12px]" />
                    </Cell>
                    <Cell>
                      <Input value={r.type} onChange={(e) => update(i, { type: e.target.value })} className="h-7 text-[12px]" />
                    </Cell>
                    <Cell>
                      <Input value={r.discipline} onChange={(e) => update(i, { discipline: e.target.value })} className="h-7 text-[12px]" />
                    </Cell>
                    <Cell>
                      <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="h-7 text-[12px]" />
                    </Cell>
                    <Cell>
                      <Input value={r.title} onChange={(e) => update(i, { title: e.target.value })} className="h-7 text-[12px]" />
                    </Cell>
                    <CellNum value={r.fy25Rate} onChange={(v) => update(i, { fy25Rate: v })} />
                    <CellNum value={r.fy26Rate} onChange={(v) => update(i, { fy26Rate: v })} />
                    <td className="px-2 py-1">
                      <button onClick={() => remove(i)} className="text-muted hover:text-bad p-1 rounded">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
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

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1">{children}</td>;
}

function CellNum({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <td className="px-2 py-1">
      <Input
        type="number"
        step="0.01"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-7 text-[12px] text-right tabular"
      />
    </td>
  );
}

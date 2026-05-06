"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import type { InvoiceLogData, InvoiceLogPeriod, InvoiceLogRow } from "@/lib/types";
import { fmtMoney } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

function emptyData(): InvoiceLogData {
  return { rows: [], periods: [] };
}

export function InvoiceLogTab({
  projectId,
  data,
}: {
  projectId: string;
  data: InvoiceLogData | null;
}) {
  const current = data ?? emptyData();

  const persist = React.useCallback(
    async (next: InvoiceLogData) => {
      // Recompute remainingBudget, cumInvoice, %spent for each row
      const rows = next.rows.map((r) => recalcRow(r));
      await db().invoiceLog.put({ projectId, data: { rows, periods: next.periods } });
    },
    [projectId],
  );

  const updateRow = (i: number, patch: Partial<InvoiceLogRow>) => {
    persist({ ...current, rows: current.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  };
  const removeRow = (i: number) => {
    if (!confirm("Remove this firm row?")) return;
    persist({ ...current, rows: current.rows.filter((_, j) => j !== i) });
  };
  const addRow = () => {
    persist({
      ...current,
      rows: [
        ...current.rows,
        { firm: "", ntpDate: null, budget: 0, remainingBudget: 0, cumInvoice: 0, pctSpent: 0, byPeriod: {} },
      ],
    });
  };
  const addPeriod = () => {
    const date = prompt("Period start date (YYYY-MM-01):", new Date().toISOString().slice(0, 7) + "-01");
    if (!date) return;
    const iso = new Date(date).toISOString();
    if (current.periods.some((p) => p.date === iso)) return;
    const d = new Date(iso);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    persist({
      ...current,
      periods: [...current.periods, { date: iso, label }].sort((a, b) => a.date.localeCompare(b.date)),
    });
  };
  const removePeriod = (date: string) => {
    if (!confirm(`Remove period ${date.slice(0, 7)}?`)) return;
    persist({
      rows: current.rows.map((r) => {
        const { [date]: _drop, ...rest } = r.byPeriod;
        return { ...r, byPeriod: rest };
      }),
      periods: current.periods.filter((p) => p.date !== date),
    });
  };
  const updatePeriodValue = (rowIdx: number, periodDate: string, value: number) => {
    const row = current.rows[rowIdx];
    persist({
      ...current,
      rows: current.rows.map((r, j) =>
        j === rowIdx ? { ...r, byPeriod: { ...r.byPeriod, [periodDate]: value } } : r,
      ),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={addPeriod}>
          <Plus size={13} /> Add period
        </Button>
        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus size={13} /> Add firm
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgba(15,15,14,0.02)]">
              <tr>
                <Th>Firm</Th>
                <Th>NTP Date</Th>
                <Th right>Budget</Th>
                <Th right>Remaining</Th>
                <Th right>Cum Invoice</Th>
                <Th right>% Spent</Th>
                {current.periods.map((p) => (
                  <th key={p.date} className="px-2 py-2 text-[11px] tabular text-muted font-medium whitespace-nowrap text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <span>{p.label}</span>
                      <button
                        onClick={() => removePeriod(p.date)}
                        className="text-muted hover:text-bad p-0.5 rounded"
                        title="Remove period"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {current.rows.length === 0 && (
                <tr>
                  <td colSpan={6 + current.periods.length + 1} className="px-3 py-6 text-center text-xs text-muted">
                    No firms yet — click "Add firm" to start tracking.
                  </td>
                </tr>
              )}
              {current.rows.map((r, i) => (
                <tr key={i} className="border-b border-line/60">
                  <Cell>
                    <Input value={r.firm} onChange={(e) => updateRow(i, { firm: e.target.value })} className="h-7 text-[12px]" />
                  </Cell>
                  <Cell>
                    <Input
                      type="date"
                      value={r.ntpDate?.slice(0, 10) ?? ""}
                      onChange={(e) =>
                        updateRow(i, { ntpDate: e.target.value ? new Date(e.target.value).toISOString() : null })
                      }
                      className="h-7 text-[12px]"
                    />
                  </Cell>
                  <CellNum value={r.budget} onChange={(v) => updateRow(i, { budget: v })} />
                  <td className="px-2 py-1 text-right tabular text-[12px] text-muted">
                    {fmtMoney(r.remainingBudget)}
                  </td>
                  <td className="px-2 py-1 text-right tabular text-[12px] text-muted">
                    {fmtMoney(r.cumInvoice, { cents: true })}
                  </td>
                  <td className="px-2 py-1 text-right tabular text-[12px] text-muted">
                    {(r.pctSpent * 100).toFixed(1)}%
                  </td>
                  {current.periods.map((p) => (
                    <td key={p.date} className="px-1 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={r.byPeriod[p.date] || ""}
                        onChange={(e) => updatePeriodValue(i, p.date, Number(e.target.value) || 0)}
                        className="h-7 text-[12px] text-right tabular"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1">
                    <button onClick={() => removeRow(i)} className="text-muted hover:text-bad p-1 rounded">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-[11px] text-muted">
        Cum Invoice and Remaining Budget update automatically when you edit period values or budget.
      </div>
    </div>
  );
}

function recalcRow(r: InvoiceLogRow): InvoiceLogRow {
  const cum = Object.values(r.byPeriod).reduce((s, v) => s + (v ?? 0), 0);
  return {
    ...r,
    cumInvoice: cum,
    remainingBudget: r.budget - cum,
    pctSpent: r.budget > 0 ? cum / r.budget : 0,
  };
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

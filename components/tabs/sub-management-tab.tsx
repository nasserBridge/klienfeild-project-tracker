"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import type { SubManagementData, SubModRow, SubRow } from "@/lib/types";
import { cn, fmtDate, fmtMoney } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

function emptyData(): SubManagementData {
  return { subs: [], mods: [] };
}

export function SubManagementTab({
  projectId,
  data,
}: {
  projectId: string;
  data: SubManagementData | null;
}) {
  const current = data ?? emptyData();

  const persist = React.useCallback(
    async (next: SubManagementData) => {
      await db().subManagement.put({ projectId, data: next });
    },
    [projectId],
  );

  const updateSub = (i: number, patch: Partial<SubRow>) => {
    const subs = current.subs.map((s, j) => (j === i ? recalcSub({ ...s, ...patch }) : s));
    persist({ subs, mods: current.mods });
  };
  const removeSub = (i: number) => {
    if (!confirm("Remove this sub?")) return;
    persist({ subs: current.subs.filter((_, j) => j !== i), mods: current.mods });
  };
  const addSub = () => {
    persist({
      subs: [
        ...current.subs,
        { firm: "", firmName: "", oriFee: 0, mods: 0, approvedFee: 0, invoicedToDate: 0, remaining: 0 },
      ],
      mods: current.mods,
    });
  };

  const updateMod = (i: number, patch: Partial<SubModRow>) => {
    const mods = current.mods.map((m, j) => (j === i ? { ...m, ...patch } : m));
    persist({ subs: current.subs, mods });
  };
  const removeMod = (i: number) => {
    if (!confirm("Remove this mod?")) return;
    persist({ subs: current.subs, mods: current.mods.filter((_, j) => j !== i) });
  };
  const addMod = () => {
    persist({
      subs: current.subs,
      mods: [...current.mods, { firm: "", oriFee: 0, mod01: 0, approvedDate: null }],
    });
  };

  const subTotals = current.subs.reduce(
    (a, s) => ({
      oriFee: a.oriFee + s.oriFee,
      mods: a.mods + s.mods,
      approvedFee: a.approvedFee + s.approvedFee,
      invoicedToDate: a.invoicedToDate + s.invoicedToDate,
      remaining: a.remaining + s.remaining,
    }),
    { oriFee: 0, mods: 0, approvedFee: 0, invoicedToDate: 0, remaining: 0 },
  );

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-muted">Subs</div>
          <Button size="sm" variant="outline" onClick={addSub}>
            <Plus size={13} /> Add sub
          </Button>
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[rgba(15,15,14,0.02)]">
                <tr>
                  <Th>Firm</Th>
                  <Th>Firm Name</Th>
                  <Th right>Original Fee</Th>
                  <Th right>Mods</Th>
                  <Th right>Approved Fee</Th>
                  <Th right>Invoiced</Th>
                  <Th right>Remaining</Th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {current.subs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted">
                      No subs yet — click "Add sub".
                    </td>
                  </tr>
                )}
                {current.subs.map((s, i) => {
                  const overInvoiced = s.invoicedToDate > s.approvedFee && s.approvedFee > 0;
                  return (
                    <tr key={i} className="border-b border-line/60">
                      <Cell>
                        <Input value={s.firm} onChange={(e) => updateSub(i, { firm: e.target.value })} className="h-7 text-[12px]" />
                      </Cell>
                      <Cell>
                        <Input value={s.firmName} onChange={(e) => updateSub(i, { firmName: e.target.value })} className="h-7 text-[12px]" />
                      </Cell>
                      <CellNum value={s.oriFee} onChange={(v) => updateSub(i, { oriFee: v })} />
                      <CellNum value={s.mods} onChange={(v) => updateSub(i, { mods: v })} />
                      <CellNum value={s.approvedFee} onChange={(v) => updateSub(i, { approvedFee: v })} />
                      <CellNum value={s.invoicedToDate} onChange={(v) => updateSub(i, { invoicedToDate: v })} className={overInvoiced ? "text-bad" : ""} />
                      <td className={cn("px-2 py-1 text-right tabular text-[12px]", overInvoiced && "text-bad")}>
                        {fmtMoney(s.remaining, { cents: true })}
                      </td>
                      <td className="px-2 py-1">
                        <button onClick={() => removeSub(i)} className="text-muted hover:text-bad p-1 rounded">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-white border-t border-lineStrong">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-[12px] font-medium">Total</td>
                  <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(subTotals.oriFee)}</td>
                  <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(subTotals.mods)}</td>
                  <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(subTotals.approvedFee)}</td>
                  <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(subTotals.invoicedToDate, { cents: true })}</td>
                  <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(subTotals.remaining, { cents: true })}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-muted">Mods</div>
          <Button size="sm" variant="outline" onClick={addMod}>
            <Plus size={13} /> Add mod
          </Button>
        </div>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[rgba(15,15,14,0.02)]">
              <tr>
                <Th>Firm</Th>
                <Th right>Original Fee</Th>
                <Th right>Mod 01</Th>
                <Th>Approved Date</Th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {current.mods.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted">
                    No mods yet — click "Add mod".
                  </td>
                </tr>
              )}
              {current.mods.map((m, i) => (
                <tr key={i} className="border-b border-line/60">
                  <Cell>
                    <Input value={m.firm} onChange={(e) => updateMod(i, { firm: e.target.value })} className="h-7 text-[12px]" />
                  </Cell>
                  <CellNum value={m.oriFee} onChange={(v) => updateMod(i, { oriFee: v })} />
                  <CellNum value={m.mod01} onChange={(v) => updateMod(i, { mod01: v })} />
                  <Cell>
                    <Input
                      type="date"
                      value={m.approvedDate?.slice(0, 10) ?? ""}
                      onChange={(e) =>
                        updateMod(i, {
                          approvedDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                      className="h-7 text-[12px]"
                    />
                  </Cell>
                  <td className="px-2 py-1">
                    <button onClick={() => removeMod(i)} className="text-muted hover:text-bad p-1 rounded">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}

function recalcSub(s: SubRow): SubRow {
  const approvedFee = (s.oriFee || 0) + (s.mods || 0);
  return { ...s, approvedFee, remaining: approvedFee - (s.invoicedToDate || 0) };
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

function CellNum({
  value,
  onChange,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <td className="px-2 py-1">
      <Input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`h-7 text-[12px] text-right tabular ${className}`}
      />
    </td>
  );
}

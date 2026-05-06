"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import type { CheckDetailRow } from "@/lib/types";
import { fmtMoney, fmtNum } from "@/lib/utils";

export function CheckDetailTab({ rows }: { rows: CheckDetailRow[] }) {
  if (!rows.length) {
    return (
      <div className="text-sm text-muted">
        No data — upload <span className="tabular">check_detail.csv</span> to see this view.
      </div>
    );
  }

  // Group by wbs2 — rows include subtotal markers
  const groups: { wbs2: string; taskName: string; rows: CheckDetailRow[]; subtotalHrs: number; subtotalBill: number }[] = [];
  let current: { wbs2: string; taskName: string; rows: CheckDetailRow[]; subtotalHrs: number; subtotalBill: number } | null = null;
  for (const r of rows) {
    if (r.isSubtotal) {
      if (current && current.wbs2 === r.wbs2) {
        current.subtotalHrs = r.hrsQty;
        current.subtotalBill = r.billAmt;
        groups.push(current);
        current = null;
      }
      continue;
    }
    if (!current || current.wbs2 !== r.wbs2) {
      if (current) groups.push(current);
      current = { wbs2: r.wbs2, taskName: r.taskName, rows: [], subtotalHrs: 0, subtotalBill: 0 };
    }
    current.rows.push(r);
  }
  if (current) groups.push(current);

  let grandHrs = 0,
    grandBill = 0;
  for (const g of groups) {
    grandHrs += g.subtotalHrs || g.rows.reduce((s, r) => s + r.hrsQty, 0);
    grandBill += g.subtotalBill || g.rows.reduce((s, r) => s + r.billAmt, 0);
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[rgba(15,15,14,0.02)]">
          <tr>
            <Th>WBS2</Th>
            <Th>Task Name</Th>
            <Th>Employee</Th>
            <Th right>Total Hours</Th>
            <Th right>Total Bill Amount</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const hrs = g.subtotalHrs || g.rows.reduce((s, r) => s + r.hrsQty, 0);
            const bill = g.subtotalBill || g.rows.reduce((s, r) => s + r.billAmt, 0);
            return (
              <React.Fragment key={g.wbs2}>
                {g.rows.map((r, i) => (
                  <tr key={`${g.wbs2}-${i}`} className="border-b border-line/60 hover:bg-rowHover">
                    <td className="px-3 py-1.5 tabular text-[12px]">{r.wbs2}</td>
                    <td className="px-3 py-1.5 text-[12px] text-muted truncate max-w-[280px]" title={r.taskName}>
                      {r.taskName}
                    </td>
                    <td className="px-3 py-1.5 text-[12px]">{r.empVenUnitName}</td>
                    <td className="px-3 py-1.5 text-right tabular text-[12px]">{fmtNum(r.hrsQty, 2)}</td>
                    <td className="px-3 py-1.5 text-right tabular text-[12px]">{fmtMoney(r.billAmt, { cents: true })}</td>
                  </tr>
                ))}
                <tr className="bg-[rgba(15,15,14,0.03)] border-b border-line">
                  <td colSpan={2} className="px-3 py-1.5 text-[12px] tabular text-muted">
                    {g.wbs2} subtotal
                  </td>
                  <td></td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px] font-medium">{fmtNum(hrs, 2)}</td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px] font-medium">
                    {fmtMoney(bill, { cents: true })}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot className="bg-white border-t border-lineStrong">
          <tr>
            <td colSpan={3} className="px-3 py-2 text-[12px] font-medium">Grand Total</td>
            <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtNum(grandHrs, 2)}</td>
            <td className="px-3 py-2 text-right tabular text-[12px] font-medium">
              {fmtMoney(grandBill, { cents: true })}
            </td>
          </tr>
        </tfoot>
      </table>
    </Card>
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

"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/status-badge";
import type { TaskSummaryRow } from "@/lib/types";
import type { HealthStatus } from "@/lib/calculations";
import { fmtDate, fmtMoney, fmtPct } from "@/lib/utils";

function statusFromPctSpent(pct: number): HealthStatus {
  if (pct > 1) return "bad";
  if (pct >= 0.85) return "watch";
  return "ok";
}

export function TaskSummaryTab({ rows }: { rows: TaskSummaryRow[] }) {
  if (!rows.length) {
    return (
      <div className="text-sm text-muted">
        No data — upload <span className="tabular">task_summary.csv</span> to see this view.
      </div>
    );
  }

  const totals = rows.reduce(
    (a, r) => ({
      laborFee: a.laborFee + r.laborFee,
      reimbursableFee: a.reimbursableFee + r.reimbursableFee,
      labFee: a.labFee + r.labFee,
      subFee: a.subFee + r.subFee,
      changeOrderAmt: a.changeOrderAmt + r.changeOrderAmt,
      totalFee: a.totalFee + r.totalFee,
      jtdRevenue: a.jtdRevenue + r.jtdRevenue,
      feeRemaining: a.feeRemaining + r.feeRemaining,
      estimateToComp: a.estimateToComp + r.estimateToComp,
      estimateAtComp: a.estimateAtComp + r.estimateAtComp,
      variance: a.variance + r.variance,
    }),
    {
      laborFee: 0,
      reimbursableFee: 0,
      labFee: 0,
      subFee: 0,
      changeOrderAmt: 0,
      totalFee: 0,
      jtdRevenue: 0,
      feeRemaining: 0,
      estimateToComp: 0,
      estimateAtComp: 0,
      variance: 0,
    },
  );

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[rgba(15,15,14,0.02)] sticky top-0">
            <tr>
              <Th>Sum Task</Th>
              <Th>Task Description</Th>
              <Th right>Labor Fee</Th>
              <Th right>Reimb. Fee</Th>
              <Th right>Lab Fee</Th>
              <Th right>Sub Fee</Th>
              <Th right>CO Amt</Th>
              <Th right>Total Fee</Th>
              <Th right>JTD Revenue</Th>
              <Th right>Remaining</Th>
              <Th right>% Comp</Th>
              <Th right>ETC</Th>
              <Th right>EAC</Th>
              <Th right>Variance</Th>
              <Th right>% Spent</Th>
              <Th>Start</Th>
              <Th>End</Th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.sumTask}-${i}`} className="border-b border-line/60 hover:bg-rowHover">
                <Td className="tabular text-[12px]">{r.sumTask}</Td>
                <Td className="max-w-[280px] truncate" title={r.taskDescription}>
                  {r.taskDescription}
                </Td>
                <Td right tabular>{fmtMoney(r.laborFee)}</Td>
                <Td right tabular>{fmtMoney(r.reimbursableFee)}</Td>
                <Td right tabular>{fmtMoney(r.labFee)}</Td>
                <Td right tabular>{fmtMoney(r.subFee)}</Td>
                <Td right tabular>{fmtMoney(r.changeOrderAmt)}</Td>
                <Td right tabular>{fmtMoney(r.totalFee)}</Td>
                <Td right tabular>{fmtMoney(r.jtdRevenue)}</Td>
                <Td right tabular>{fmtMoney(r.feeRemaining)}</Td>
                <Td right tabular>{fmtPct(r.pctComplete, 0)}</Td>
                <Td right tabular>{fmtMoney(r.estimateToComp)}</Td>
                <Td right tabular>{fmtMoney(r.estimateAtComp)}</Td>
                <Td right tabular>{fmtMoney(r.variance)}</Td>
                <Td right tabular>{fmtPct(r.pctSpent, 0)}</Td>
                <Td className="text-[11px]">{fmtDate(r.startDate)}</Td>
                <Td className="text-[11px]">{fmtDate(r.endDate)}</Td>
                <td className="w-6"><StatusDot status={statusFromPctSpent(r.pctSpent)} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-white border-t border-lineStrong sticky bottom-0">
            <tr>
              <td colSpan={2} className="px-3 py-2 text-[12px] font-medium">Total</td>
              <Td right tabular bold>{fmtMoney(totals.laborFee)}</Td>
              <Td right tabular bold>{fmtMoney(totals.reimbursableFee)}</Td>
              <Td right tabular bold>{fmtMoney(totals.labFee)}</Td>
              <Td right tabular bold>{fmtMoney(totals.subFee)}</Td>
              <Td right tabular bold>{fmtMoney(totals.changeOrderAmt)}</Td>
              <Td right tabular bold>{fmtMoney(totals.totalFee)}</Td>
              <Td right tabular bold>{fmtMoney(totals.jtdRevenue)}</Td>
              <Td right tabular bold>{fmtMoney(totals.feeRemaining)}</Td>
              <td></td>
              <Td right tabular bold>{fmtMoney(totals.estimateToComp)}</Td>
              <Td right tabular bold>{fmtMoney(totals.estimateAtComp)}</Td>
              <Td right tabular bold>{fmtMoney(totals.variance)}</Td>
              <td colSpan={4}></td>
            </tr>
          </tfoot>
        </table>
      </div>
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

function Td({
  children,
  right,
  tabular,
  bold,
  className = "",
  title,
}: {
  children: React.ReactNode;
  right?: boolean;
  tabular?: boolean;
  bold?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <td
      className={
        "px-3 py-1.5 text-[12px] " +
        (right ? "text-right " : "") +
        (tabular ? "tabular " : "") +
        (bold ? "font-medium " : "") +
        className
      }
      title={title}
    >
      {children}
    </td>
  );
}

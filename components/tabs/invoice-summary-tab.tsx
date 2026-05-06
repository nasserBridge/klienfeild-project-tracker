"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import type { InvoiceSummaryRow } from "@/lib/types";
import { fmtMoney, fmtPct } from "@/lib/utils";

export function InvoiceSummaryTab({ rows }: { rows: InvoiceSummaryRow[] }) {
  if (!rows.length) {
    return (
      <div className="text-sm text-muted">
        No data — upload <span className="tabular">invoice_summary.csv</span> to see this view.
      </div>
    );
  }

  const totals = rows.reduce(
    (a, r) => ({
      totalFee: a.totalFee + r.totalFee,
      cumInvoiceToDate: a.cumInvoiceToDate + r.cumInvoiceToDate,
      jtdRevenue: a.jtdRevenue + r.jtdRevenue,
      paidToDate: a.paidToDate + r.paidToDate,
      arOver60: a.arOver60 + r.arOver60,
      estCurrentInvoice: a.estCurrentInvoice + r.estCurrentInvoice,
    }),
    { totalFee: 0, cumInvoiceToDate: 0, jtdRevenue: 0, paidToDate: 0, arOver60: 0, estCurrentInvoice: 0 },
  );
  const totalRemaining = totals.totalFee - totals.cumInvoiceToDate;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Chip label="Total Fee" value={fmtMoney(totals.totalFee)} />
        <Chip label="Total Invoiced To Date" value={fmtMoney(totals.cumInvoiceToDate)} />
        <Chip label="Total Remaining" value={fmtMoney(totalRemaining)} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgba(15,15,14,0.02)] sticky top-0">
              <tr>
                <Th>Task</Th>
                <Th>Description</Th>
                <Th right>Total Fee</Th>
                <Th right>Est. Current Invoice</Th>
                <Th right>Cum Invoice To Date</Th>
                <Th right>JTD Revenue</Th>
                <Th right>EAC</Th>
                <Th right>% Spent</Th>
                <Th right>% Comp</Th>
                <Th right>Paid To Date</Th>
                <Th right>AR Over 60</Th>
                <Th right>NRM</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.task}-${i}`} className="border-b border-line/60 hover:bg-rowHover">
                  <td className="px-3 py-1.5 tabular text-[12px]">{r.task}</td>
                  <td className="px-3 py-1.5 text-[12px] max-w-[280px] truncate" title={r.taskDescription}>
                    {r.taskDescription}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">{fmtMoney(r.totalFee)}</td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">{fmtMoney(r.estCurrentInvoice, { cents: true })}</td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">{fmtMoney(r.cumInvoiceToDate, { cents: true })}</td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">{fmtMoney(r.jtdRevenue, { cents: true })}</td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">{fmtMoney(r.estimateAtComplete, { cents: true })}</td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">{fmtPct(r.pctSpent, 0)}</td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">{fmtPct(r.pctComp, 0)}</td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">{fmtMoney(r.paidToDate, { cents: true })}</td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">{fmtMoney(r.arOver60)}</td>
                  <td className="px-3 py-1.5 text-right tabular text-[12px]">{r.nrm.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-white border-t border-lineStrong sticky bottom-0">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-[12px] font-medium">Total</td>
                <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(totals.totalFee)}</td>
                <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(totals.estCurrentInvoice, { cents: true })}</td>
                <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(totals.cumInvoiceToDate, { cents: true })}</td>
                <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(totals.jtdRevenue, { cents: true })}</td>
                <td colSpan={3}></td>
                <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(totals.paidToDate, { cents: true })}</td>
                <td className="px-3 py-2 text-right tabular text-[12px] font-medium">{fmtMoney(totals.arOver60)}</td>
                <td></td>
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

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-line rounded-md px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted mb-1">{label}</div>
      <div className="serif text-2xl tabular">{value}</div>
    </div>
  );
}

"use client";
import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TransRow } from "@/lib/types";
import { revenueByPeriod } from "@/lib/calculations";
import { fmtMoney } from "@/lib/utils";

function fyLabel(period: string): string {
  // Format YYYYPP — fiscal period. We don't know the firm's fiscal calendar,
  // so just render as "FY{YY} P{PP}" which is the common Deltek shorthand.
  if (!/^\d{6}$/.test(period)) return period;
  const yy = period.slice(2, 4);
  const pp = period.slice(4);
  return `FY${yy} P${pp}`;
}

export function RevenueByPeriodTab({ trans }: { trans: TransRow[] }) {
  const data = React.useMemo(() => revenueByPeriod(trans), [trans]);

  if (data.rows.length === 0) {
    return <div className="text-sm text-muted">No revenue data — upload Proj Trans Detail first.</div>;
  }

  const chartData = data.rows.map((r) => ({ ...r, label: fyLabel(r.period) }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Revenue by fiscal period</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="rgba(15,15,14,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                fontSize={11}
                stroke="#6B6B66"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                fontSize={11}
                stroke="#6B6B66"
                axisLine={false}
                tickLine={false}
                width={60}
                tickFormatter={(v) => fmtMoney(v as number, { compact: true })}
              />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid rgba(15,15,14,0.16)",
                  borderRadius: 4,
                  fontSize: 12,
                }}
                formatter={(v: number) => [fmtMoney(v as number), "Revenue"]}
              />
              <Bar dataKey="revenue" fill="#1A4D3A" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[rgba(15,15,14,0.02)]">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium border-b border-line">
                Period
              </th>
              <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium border-b border-line">
                Revenue
              </th>
              <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium border-b border-line">
                Cumulative
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.period} className="border-b border-line/60 hover:bg-rowHover">
                <td className="px-3 py-1.5 tabular text-[12px]">
                  {fyLabel(r.period)}{" "}
                  <span className="text-muted">({r.period})</span>
                </td>
                <td className="px-3 py-1.5 text-right tabular">{fmtMoney(r.revenue, { cents: true })}</td>
                <td className="px-3 py-1.5 text-right tabular text-muted">
                  {fmtMoney(r.cumulative, { cents: true })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-white border-t border-lineStrong">
            <tr>
              <td className="px-3 py-2 font-medium">Total</td>
              <td className="px-3 py-2 text-right tabular font-medium">
                {fmtMoney(data.total, { cents: true })}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}

"use client";
import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { StatBar, StatCard, StatRow } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AllDataRow, TransRow } from "@/lib/types";
import {
  computeHealth,
  cumulativeHours,
  getProjectTotal,
} from "@/lib/calculations";
import { daysBetween, fmtDate, fmtMoney, fmtNum, fmtPct } from "@/lib/utils";

export function SummaryTab({
  allData,
  trans,
}: {
  allData: AllDataRow[];
  trans: TransRow[];
}) {
  const total = React.useMemo(() => getProjectTotal(allData), [allData]);

  if (!total) {
    return (
      <div className="text-sm text-muted">
        No PM Web data uploaded for this project yet. Use “Refresh data” to add it.
      </div>
    );
  }

  const health = computeHealth(total);
  const cum = React.useMemo(() => cumulativeHours(trans), [trans]);
  const totalDays = daysBetween(total.startDate, total.estCompDate);
  const elapsed = total.startDate ? daysBetween(total.startDate, new Date().toISOString()) : null;
  const remainingDays = totalDays !== null && elapsed !== null ? totalDays - elapsed : null;
  const pctTime = health.pctTimeElapsed;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Budget vs. Spent">
          <StatRow label="Total Fee" value={fmtMoney(total.totalFee)} emphasize />
          <StatRow label="JTD Net Revenue" value={fmtMoney(total.netRev)} />
          <StatRow label="Remaining" value={fmtMoney(total.remainingTotalFee)} />
          <div>
            <div className="flex justify-between text-[11px] text-muted mb-1">
              <span>% consumed</span>
              <span className="tabular">{fmtPct(health.pctSpent, 0)}</span>
            </div>
            <StatBar pct={health.pctSpent} />
          </div>
        </StatCard>

        <StatCard title="Hours">
          <StatRow label="JTD Hours" value={fmtNum(total.jtdHours, 1)} emphasize />
          <StatRow label="MTD Hours" value={fmtNum(total.mtdHours, 1)} />
          <StatRow label="Last Week Hours" value={fmtNum(total.lastWeekHrs, 1)} />
        </StatCard>

        <StatCard title="Profitability">
          <StatRow label="Profit %" value={fmtPct(total.profitPct, 1)} emphasize />
          <StatRow
            label="Multiplier JTD"
            value={
              <span className="tabular">
                {total.multiplierJtd?.toFixed(2) ?? "—"}{" "}
                <span className="text-muted text-xs">
                  / {total.targetMultiplierJtd?.toFixed(2) ?? "—"}
                </span>
              </span>
            }
          />
          <StatRow label="GM %" value={fmtPct(total.gmPct, 1)} />
        </StatCard>

        <StatCard title="Schedule">
          <StatRow label="Start Date" value={fmtDate(total.startDate)} />
          <StatRow label="Est Comp Date" value={fmtDate(total.estCompDate)} />
          <StatRow
            label="Days remaining"
            value={remainingDays !== null ? fmtNum(remainingDays) : "—"}
            emphasize
          />
          <div>
            <div className="flex justify-between text-[11px] text-muted mb-1">
              <span>% time elapsed</span>
              <span className="tabular">{pctTime !== null ? fmtPct(pctTime, 0) : "—"}</span>
            </div>
            <StatBar pct={pctTime ?? 0} />
          </div>
        </StatCard>
      </div>

      <Card>
        <CardHeader className="flex items-center gap-3 flex-row pb-3">
          <CardTitle className="m-0">Health</CardTitle>
          <StatusBadge status={health.status} label={health.label} />
        </CardHeader>
        <CardContent>
          <div className="text-sm text-ink leading-relaxed">{health.reason}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cumulative hours</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          {cum.length === 0 ? (
            <div className="text-sm text-muted">No transaction data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cum} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="rgba(15,15,14,0.06)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                  fontSize={11}
                  stroke="#6B6B66"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis fontSize={11} stroke="#6B6B66" axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid rgba(15,15,14,0.16)",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                  labelFormatter={(d) =>
                    new Date(d as string).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                  formatter={(v: number) => [fmtNum(v as number, 1), "Cumulative"]}
                />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#1A4D3A"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

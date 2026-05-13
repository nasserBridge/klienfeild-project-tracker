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
  Legend,
} from "recharts";
import { StatBar, StatCard, StatRow } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AllDataRow, ETCRow, TransRow } from "@/lib/types";
import {
  computeHealth,
  cumulativeHours,
  getProjectTotal,
} from "@/lib/calculations";
import { daysBetween, fmtDate, fmtMoney, fmtNum, fmtPct } from "@/lib/utils";

export function SummaryTab({
  allData,
  trans,
  etc,
}: {
  allData: AllDataRow[];
  trans: TransRow[];
  etc: ETCRow[];
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

  // Total budget hours across the ETC sheet — updates live as Budget Hrs are edited.
  const totalBudgetHrs = React.useMemo(
    () => etc.reduce((s, r) => s + (r.budgetHrs || 0), 0),
    [etc],
  );

  // Build a combined chart series: actual cumulative (stepped per trans date)
  // and budget cumulative (per-task linear allocation).
  //
  //   For every ETC row with Budget Hrs > 0, those hours are spread linearly
  //   across that row's TASK window — Start Date → Est Comp Date from PM Web
  //   all-data. We then sum across all rows for each date on the X-axis.
  //   This way an early task (1.1 ending Feb) bows the curve up earlier than
  //   a late task (5.0 starting June), instead of pretending every hour is
  //   spread evenly across the whole project.
  //
  //   Rows whose task has no dates fall back to the project's overall
  //   start/end dates so they still contribute to the curve.
  const chartData = React.useMemo(() => {
    const projStartMs = total.startDate ? new Date(total.startDate).getTime() : null;
    const projEndMs = total.estCompDate ? new Date(total.estCompDate).getTime() : null;

    // Look up each task's window from PM Web sub-task rows.
    const taskWindow = new Map<string, { startMs: number; endMs: number }>();
    for (const r of allData) {
      if (!r.taskCode) continue;
      const s = r.startDate ? new Date(r.startDate).getTime() : null;
      const e = r.estCompDate ? new Date(r.estCompDate).getTime() : null;
      if (s !== null && e !== null && e > s) taskWindow.set(r.taskCode, { startMs: s, endMs: e });
    }

    // Pre-compute each ETC row's contribution function: given a date in ms,
    // returns the cumulative budget hours that row has "delivered" by that date.
    const contributions = etc
      .filter((r) => (r.budgetHrs || 0) > 0)
      .map((r) => {
        const w = taskWindow.get(r.task);
        const startMs = w?.startMs ?? projStartMs;
        const endMs = w?.endMs ?? projEndMs;
        return { budget: r.budgetHrs, startMs, endMs };
      });

    const budgetAt = (ms: number): number => {
      let sum = 0;
      for (const c of contributions) {
        if (c.startMs === null || c.endMs === null || c.endMs <= c.startMs) continue;
        if (ms <= c.startMs) continue;
        const t = ms >= c.endMs ? 1 : (ms - c.startMs) / (c.endMs - c.startMs);
        sum += c.budget * t;
      }
      return Math.round(sum * 10) / 10;
    };

    // X-axis dates: every K-Fasts trans date + every task boundary so the
    // piecewise curve has knees right where tasks start and end.
    const dateSet = new Set<string>(cum.map((c) => c.date));
    if (total.startDate) dateSet.add(new Date(total.startDate).toISOString().slice(0, 10));
    if (total.estCompDate) dateSet.add(new Date(total.estCompDate).toISOString().slice(0, 10));
    for (const w of taskWindow.values()) {
      dateSet.add(new Date(w.startMs).toISOString().slice(0, 10));
      dateSet.add(new Date(w.endMs).toISOString().slice(0, 10));
    }

    const cumByDate = new Map(cum.map((c) => [c.date, c.cumulative]));
    const dates = [...dateSet].sort();

    // Stepped actuals — carry forward past the last log so the line doesn't
    // visually drop to null.
    let lastActual: number | null = null;
    return dates.map((d) => {
      const actual = cumByDate.get(d);
      if (actual !== undefined) lastActual = actual;
      const ms = new Date(d).getTime();
      const budget = contributions.length > 0 ? budgetAt(ms) : null;
      return { date: d, actual: lastActual, budget };
    });
  }, [cum, total.startDate, total.estCompDate, allData, etc]);

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
            label="Target Multiplier JTD"
            value={
              <span className="tabular text-muted">
                {total.targetMultiplierJtd?.toFixed(2) ?? "—"}
              </span>
            }
          />
          <StatRow
            label="Multiplier JTD"
            value={
              <span
                className={
                  "tabular " +
                  (total.multiplierJtd !== null &&
                  total.targetMultiplierJtd !== null &&
                  total.multiplierJtd < total.targetMultiplierJtd
                    ? "text-bad"
                    : "")
                }
              >
                {total.multiplierJtd?.toFixed(2) ?? "—"}
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
        <CardHeader className="flex items-center justify-between flex-row pb-3">
          <CardTitle className="m-0">Cumulative hours</CardTitle>
          {totalBudgetHrs > 0 && (
            <div className="text-[11px] text-muted">
              Budget total <span className="tabular text-ink">{fmtNum(totalBudgetHrs, 1)}</span> hrs
            </div>
          )}
        </CardHeader>
        <CardContent className="h-[280px]">
          {chartData.length === 0 ? (
            <div className="text-sm text-muted">No transaction data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
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
                  formatter={(v, name) => {
                    if (v === null || v === undefined) return ["—", String(name)];
                    const n = typeof v === "number" ? v : Number(v);
                    return [Number.isFinite(n) ? fmtNum(n, 1) : "—", String(name)];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual hrs"
                  stroke="#1A4D3A"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                {totalBudgetHrs > 0 && (
                  <Line
                    type="monotone"
                    dataKey="budget"
                    name="Budget hrs"
                    stroke="#B07020"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

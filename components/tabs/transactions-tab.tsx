"use client";
import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import type { TransRow } from "@/lib/types";
import { fmtMoney, fmtNum } from "@/lib/utils";

const PAGE_SIZE = 50;

export function TransactionsTab({ trans }: { trans: TransRow[] }) {
  const [search, setSearch] = React.useState("");
  const [from, setFrom] = React.useState<string>("");
  const [to, setTo] = React.useState<string>("");
  const [page, setPage] = React.useState(0);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return trans
      .filter((t) => {
        if (q) {
          const hay = `${t.empVenUnitName} ${t.taskName} ${t.wbs2} ${t.commentDesc ?? ""} ${t.activity ?? ""} ${t.billTitle ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (from && t.transDate.slice(0, 10) < from) return false;
        if (to && t.transDate.slice(0, 10) > to) return false;
        return true;
      })
      .sort((a, b) => b.transDate.localeCompare(a.transDate));
  }, [trans, search, from, to]);

  React.useEffect(() => setPage(0), [search, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Virtualize the page rows for nice perf
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: paged.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-[420px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
          <Input
            placeholder="Search employee, task, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>From</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[140px] h-9" />
          <span>To</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[140px] h-9" />
          {(from || to || search) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setFrom("");
                setTo("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="ml-auto text-xs text-muted">
          {fmtNum(filtered.length)} of {fmtNum(trans.length)} transactions
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[110px_1fr_1fr_70px_90px_100px_1fr] gap-0 px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-medium border-b border-line bg-[rgba(15,15,14,0.02)]">
          <div>Date</div>
          <div>Employee</div>
          <div>Task</div>
          <div className="text-right">Hours</div>
          <div className="text-right">Rate</div>
          <div className="text-right">Bill Amt</div>
          <div>Description</div>
        </div>
        <div ref={parentRef} className="max-h-[60vh] overflow-y-auto">
          {paged.length === 0 ? (
            <div className="p-6 text-sm text-muted text-center">No matching transactions.</div>
          ) : (
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const r = paged[vi.index];
                return (
                  <div
                    key={vi.key}
                    className="grid grid-cols-[110px_1fr_1fr_70px_90px_100px_1fr] gap-0 px-3 py-1.5 text-[12px] border-b border-line/60 hover:bg-rowHover"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${vi.start}px)`,
                    }}
                  >
                    <div className="tabular text-ink">{r.transDate.slice(0, 10)}</div>
                    <div className="truncate" title={r.empVenUnitName}>{r.empVenUnitName}</div>
                    <div className="truncate text-muted" title={`${r.wbs2} — ${r.taskName}`}>
                      <span className="tabular text-ink mr-1.5">{r.wbs2}</span>
                      {r.taskName}
                    </div>
                    <div className="text-right tabular">{fmtNum(r.hrsQty, 2)}</div>
                    <div className="text-right tabular">{fmtMoney(r.rate, { cents: true })}</div>
                    <div className="text-right tabular">{fmtMoney(r.billAmt, { cents: true })}</div>
                    <div className="truncate text-muted" title={r.commentDesc ?? ""}>
                      {r.commentDesc ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted">
        <div>
          Page <span className="tabular">{page + 1}</span> of{" "}
          <span className="tabular">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

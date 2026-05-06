import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Money formatter. Defaults to 2-decimal display ("$1,234.56").
 * - `cents: false` keeps 2 decimals — kept for backward compatibility but no longer hides cents.
 * - `compact: true` formats large values as "1.23M" / "1.5K" (still 2 decimals on M).
 */
export function fmtMoney(n: number | null | undefined, opts?: { compact?: boolean; cents?: boolean }) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const absV = Math.abs(n);
  if (opts?.compact && absV >= 1000) {
    if (absV >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (absV >= 1000) return `${(n / 1000).toFixed(2)}K`;
  }
  // Always show 2 decimal places.
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Number formatter. Defaults to 2 decimal places. */
export function fmtNum(n: number | null | undefined, decimals = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Percentage formatter. Input is a 0–1 decimal. Defaults to 2 decimal places. */
export function fmtPct(n: number | null | undefined, decimals = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(decimals)}%`;
}

/** Round a number to 2 decimal places (avoids floating-point accumulation drift). */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function safeNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,]/g, "").trim();
    if (cleaned === "" || cleaned === "NaN") return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function safeString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return String(v);
}

/** Convert an Excel cell that might be a Date object, ISO string, or Excel serial into ISO string */
export function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString();
  }
  if (typeof v === "number") {
    // Excel serial date (days since 1899-12-30)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/** Monday of the week containing the given date (UTC, ISO date string YYYY-MM-DD) */
export function weekStartingMonday(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay(); // 0..6 (Sun..Sat)
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysBetween(aIso: string | null, bIso: string | null): number | null {
  if (!aIso || !bIso) return null;
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

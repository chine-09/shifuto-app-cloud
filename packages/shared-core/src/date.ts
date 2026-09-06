export const WEEKDAY_LABELS_JA = ["日", "月", "火", "水", "木", "金", "土"];

/** Local-date (not UTC) days for a given year/month (1-12), avoiding timezone shift bugs. */
export function daysInMonth(year: number, month: number): Date[] {
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(year, month - 1, i + 1));
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses a YYYY-MM-DD string as a local date (not UTC), avoiding timezone shift bugs. */
export function fromDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function weekdayOf(date: Date): number {
  return date.getDay();
}

/**
 * Resolves every date-key (YYYY-MM-DD) in the inclusive range [start, end],
 * optionally filtered to a set of weekdays (0=Sun ... 6=Sat).
 * Shared by the bulk shift-creation UI and the bulk headcount-requirement UI.
 */
export function resolveDatesInRange(
  start: string,
  end: string,
  weekdays?: number[],
): string[] {
  const startDate = fromDateKey(start);
  const endDate = fromDateKey(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }
  if (startDate.getTime() > endDate.getTime()) return [];

  const weekdaySet = weekdays && weekdays.length > 0 ? new Set(weekdays) : null;

  const result: string[] = [];
  const cursor = new Date(startDate);
  while (cursor.getTime() <= endDate.getTime()) {
    if (!weekdaySet || weekdaySet.has(weekdayOf(cursor))) {
      result.push(toDateKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

/** Sunday-based start-of-week date-key for grouping dates into weeks. */
export function startOfWeekKey(dateKey: string): string {
  const date = fromDateKey(dateKey);
  const diff = date.getDate() - weekdayOf(date);
  const start = new Date(date.getFullYear(), date.getMonth(), diff);
  return toDateKey(start);
}

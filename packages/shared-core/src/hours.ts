import type { ShiftType } from "./types/shift";
import type { TaskSegment } from "./types/task";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Derives the coarse "work" shift (start/end span, worked hours) that a set
 * of same-day task segments implies, so the detailed Gantt view can keep the
 * existing AssignedShift in sync — everything else (violation checks, Excel
 * export, weekly-hours totals) keeps reading AssignedShift and never needs
 * to know segments exist. Break segments (taskId === null) count toward the
 * span but not toward worked hours.
 */
export function summarizeTaskSegments(segments: TaskSegment[]): { startTime: string; endTime: string; hours: number } | null {
  if (segments.length === 0) return null;
  const starts = segments.map((s) => toMinutes(s.startTime));
  const ends = segments.map((s) => toMinutes(s.endTime));
  const startTime = segments[starts.indexOf(Math.min(...starts))].startTime;
  const endTime = segments[ends.indexOf(Math.max(...ends))].endTime;
  const workedMinutes = segments
    .filter((s) => s.taskId !== null)
    .reduce((sum, s) => sum + (toMinutes(s.endTime) - toMinutes(s.startTime)), 0);
  return { startTime, endTime, hours: workedMinutes / 60 };
}

/** No server round-trip computes this for us anymore, so the client derives it locally. */
export function computeShiftHours(
  shiftType: ShiftType,
  startTime: string | null,
  endTime: string | null,
): number {
  if (shiftType !== "work" || !startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

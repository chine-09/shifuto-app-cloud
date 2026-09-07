import type { TaskSegment } from "@shifuto/shared-core";
import { addMinutesToTime } from "../timeGrid";

export const QUICK_ADD_MINUTES = 60;

/**
 * Given an employee's existing segments for the day and a click-snapped
 * start time, returns the end time for a QUICK_ADD_MINUTES-long segment —
 * clipped to whichever comes first, the next existing segment's start or
 * gridEnd — or null if startTime already falls inside an existing segment
 * or there's no room left at all.
 */
export function computeQuickAddEnd(
  existingSegments: TaskSegment[],
  startTime: string,
  gridEnd: string,
): string | null {
  const coveredByExisting = existingSegments.some((s) => startTime >= s.startTime && startTime < s.endTime);
  if (coveredByExisting) return null;

  let end = addMinutesToTime(startTime, QUICK_ADD_MINUTES);
  if (end > gridEnd) end = gridEnd;

  const nextStart = existingSegments
    .map((s) => s.startTime)
    .filter((t) => t > startTime)
    .sort()[0];
  if (nextStart && nextStart < end) end = nextStart;

  return end > startTime ? end : null;
}

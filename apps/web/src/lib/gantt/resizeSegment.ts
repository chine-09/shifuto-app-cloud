import type { TaskSegment } from "@shifuto/shared-core";

/**
 * Resizes one segment to [newStartTime, newEndTime] and, if another segment
 * was touching the edge that moved (e.g. "品出し" ends exactly where "レジ"
 * begins), drags that neighbor's matching boundary along with it — so
 * adjacent segments stay contiguous instead of opening a gap or overlapping.
 * Returns the full updated segment list for this employee/day, or null if
 * the result would be invalid (a segment inverted, or an overlap with a
 * segment that wasn't the moving boundary's neighbor).
 */
export function resizeSegmentWithNeighbors(
  segments: TaskSegment[],
  segmentId: string,
  newStartTime: string,
  newEndTime: string,
): TaskSegment[] | null {
  const original = segments.find((s) => s.id === segmentId);
  if (!original) return null;

  const others = segments.filter((s) => s.id !== segmentId);
  const adjustedOthers = others.map((s) => {
    if (newStartTime !== original.startTime && s.endTime === original.startTime) {
      return { ...s, endTime: newStartTime };
    }
    if (newEndTime !== original.endTime && s.startTime === original.endTime) {
      return { ...s, startTime: newEndTime };
    }
    return s;
  });

  const resized = { ...original, startTime: newStartTime, endTime: newEndTime };
  const all = [...adjustedOthers, resized];

  if (all.some((s) => s.startTime >= s.endTime)) return null;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (all[i].startTime < all[j].endTime && all[i].endTime > all[j].startTime) return null;
    }
  }
  return all;
}

import type { TaskSegment } from "@shifuto/shared-core";
import { addMinutesToTime, toMinutes } from "../timeGrid";

function durationMinutes(s: TaskSegment): number {
  return toMinutes(s.endTime) - toMinutes(s.startTime);
}

/** Re-chains a set of segments back-to-back from a fixed anchor, in whatever order they're given, preserving each one's own duration. */
function rechain(order: TaskSegment[], anchor: string): TaskSegment[] {
  let cursor = anchor;
  return order.map((s) => {
    const start = cursor;
    const end = addMinutesToTime(start, durationMinutes(s));
    cursor = end;
    return { ...s, startTime: start, endTime: end };
  });
}

/**
 * One step of drag-to-reorder: if `cursorTime` has crossed the midpoint of
 * the dragged segment's current left or right neighbor, swaps places with
 * that neighbor (each segment keeps its own duration — the neighbor simply
 * moves to occupy the dragged segment's old slot and vice versa) and
 * re-chains the whole day contiguously from the original leftmost start.
 * Returns `segments` unchanged if no swap is triggered. Called on every
 * pointermove during a drag, so multiple swaps naturally cascade as the
 * cursor keeps moving — this only ever needs to look one neighbor ahead.
 */
export function stepReorder(segments: TaskSegment[], draggedId: string, cursorTime: string): TaskSegment[] {
  const order = [...segments].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const anchor = order[0]?.startTime;
  if (anchor === undefined) return segments;

  const index = order.findIndex((s) => s.id === draggedId);
  if (index === -1) return segments;

  if (index > 0) {
    const prev = order[index - 1];
    const prevMid = addMinutesToTime(prev.startTime, durationMinutes(prev) / 2);
    if (cursorTime < prevMid) {
      [order[index - 1], order[index]] = [order[index], order[index - 1]];
      return rechain(order, anchor);
    }
  }
  if (index < order.length - 1) {
    const next = order[index + 1];
    const nextMid = addMinutesToTime(next.startTime, durationMinutes(next) / 2);
    if (cursorTime > nextMid) {
      [order[index + 1], order[index]] = [order[index], order[index + 1]];
      return rechain(order, anchor);
    }
  }
  return segments;
}

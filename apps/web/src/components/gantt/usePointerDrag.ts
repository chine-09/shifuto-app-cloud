import { useCallback, type RefObject } from "react";
import { timeAtPercent } from "../../lib/timeGrid";

/**
 * Wires up a window pointermove/pointerup drag sequence shared by segment
 * resize and move — call from a pointerdown handler (after that handler
 * does its own e.stopPropagation()/preventDefault()). On each move,
 * computes the "HH:mm" time under the pointer relative to `trackRef`'s
 * bounding rect and the grid range, then hands it (plus the raw event, for
 * callers that need e.g. clientX directly) to `onMove`; cleans up its own
 * listeners and calls `onEnd` on pointerup. The rect is measured once at
 * drag start, not on every move.
 */
export function usePointerDrag(trackRef: RefObject<HTMLElement | null>, gridStart: string, gridEnd: string) {
  return useCallback(
    (onMove: (time: string, ev: PointerEvent) => void, onEnd: () => void) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;

      function handleMove(ev: PointerEvent) {
        const percent = ((ev.clientX - rect!.left) / rect!.width) * 100;
        onMove(timeAtPercent(percent, gridStart, gridEnd), ev);
      }

      function handleUp() {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        onEnd();
      }

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [trackRef, gridStart, gridEnd],
  );
}

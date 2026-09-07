import { useRef, useState } from "react";
import type { PiiEmployee, TaskSegment, WorkTask } from "@shifuto/shared-core";
import { percentWithinGrid, timeAtPercent } from "../../lib/timeGrid";
import { resizeSegmentWithNeighbors } from "../../lib/gantt/resizeSegment";
import { stepReorder } from "../../lib/gantt/reorderSegments";
import { CopyIcon, PasteIcon, XIcon } from "./icons";
import { BREAK_COLOR } from "./constants";
import { usePointerDrag } from "./usePointerDrag";

// Below this many pixels of pointer travel, a press-and-release on a
// segment's body is treated as a click (open the edit modal), not a drag.
const MOVE_THRESHOLD_PX = 4;

export function DayGanttRow({
  employee,
  segments,
  workTasksById,
  gridStart,
  gridEnd,
  onAddSegment,
  onEditSegment,
  onResizeSegment,
  onReorderSegments,
  isCopySource,
  canPaste,
  onCopy,
  onCancelCopy,
  onPaste,
  quickAddActive,
  onQuickAdd,
}: {
  employee: PiiEmployee;
  segments: TaskSegment[];
  workTasksById: Map<WorkTask["id"], WorkTask>;
  gridStart: string;
  gridEnd: string;
  onAddSegment: () => void;
  onEditSegment: (segment: TaskSegment) => void;
  onResizeSegment: (segment: TaskSegment, startTime: string, endTime: string) => void;
  onReorderSegments: (segments: TaskSegment[]) => void;
  isCopySource: boolean;
  canPaste: boolean;
  onCopy: () => void;
  onCancelCopy: () => void;
  onPaste: () => void;
  quickAddActive: boolean;
  onQuickAdd: (startTime: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftSegments, setDraftSegments] = useState<TaskSegment[] | null>(null);
  // Mutable, up-to-date copy of the dragged segment's own live start/end —
  // read synchronously inside handleMove without waiting on React state.
  const liveRef = useRef<{ startTime: string; endTime: string } | null>(null);
  const startPointerDrag = usePointerDrag(trackRef, gridStart, gridEnd);

  function startResize(segment: TaskSegment, edge: "start" | "end", e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();

    liveRef.current = { startTime: segment.startTime, endTime: segment.endTime };
    setActiveId(segment.id);

    startPointerDrag(
      e,
      (time) => {
        const cur = liveRef.current!;

        let nextStart = cur.startTime;
        let nextEnd = cur.endTime;
        if (edge === "start") {
          if (time >= cur.endTime) return;
          nextStart = time;
        } else {
          if (time <= cur.startTime) return;
          nextEnd = time;
        }

        // Dragging past a neighbor's own far boundary (or into another
        // segment entirely) makes the whole arrangement invalid — ignore
        // this move rather than let the bar jump somewhere nonsensical;
        // the drag simply stalls at the last valid position until the
        // pointer returns to a valid one.
        const preview = resizeSegmentWithNeighbors(segments, segment.id, nextStart, nextEnd);
        if (!preview) return;

        liveRef.current = { startTime: nextStart, endTime: nextEnd };
        setDraftSegments(preview);
      },
      () => {
        const final = liveRef.current;
        liveRef.current = null;
        setActiveId(null);
        setDraftSegments(null);
        if (final && (final.startTime !== segment.startTime || final.endTime !== segment.endTime)) {
          onResizeSegment(segment, final.startTime, final.endTime);
        }
      },
    );
  }

  function startMove(segment: TaskSegment, e: React.PointerEvent) {
    e.stopPropagation();

    const startX = e.clientX;
    let moved = false;
    let current = segments;
    setActiveId(segment.id);

    startPointerDrag(
      e,
      (time, ev) => {
        if (!moved) {
          if (Math.abs(ev.clientX - startX) < MOVE_THRESHOLD_PX) return;
          moved = true;
        }
        const next = stepReorder(current, segment.id, time);
        if (next !== current) {
          current = next;
          setDraftSegments(current);
        }
      },
      () => {
        setActiveId(null);
        setDraftSegments(null);
        if (moved) {
          onReorderSegments(current);
        } else {
          onEditSegment(segment);
        }
      },
    );
  }

  const displaySegments = draftSegments ?? segments;

  return (
    <div
      className={`flex items-stretch gap-2 border-b py-1.5 last:border-b-0 ${
        isCopySource ? "rounded-sm border-y-2 border-dashed border-brand bg-brand-light" : "border-zinc-100"
      }`}
    >
      <div className="w-28 shrink-0 truncate py-1.5 text-sm text-zinc-700" title={employee.name}>
        {employee.name}
      </div>
      <div
        ref={trackRef}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if (!quickAddActive) {
            onAddSegment();
            return;
          }
          const rect = trackRef.current?.getBoundingClientRect();
          if (!rect) return;
          const percent = ((e.clientX - rect.left) / rect.width) * 100;
          onQuickAdd(timeAtPercent(percent, gridStart, gridEnd));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onAddSegment();
        }}
        className={`relative h-9 flex-1 rounded-sm bg-zinc-50 ring-1 ring-inset ring-zinc-200 ${
          quickAddActive ? "cursor-copy hover:ring-brand" : "hover:ring-blue-300"
        }`}
        title={quickAddActive ? "クリックして1時間分配置" : "クリックして時間帯を追加"}
      >
        {displaySegments.map((segment) => {
          const isActive = segment.id === activeId;
          const left = percentWithinGrid(segment.startTime, gridStart, gridEnd);
          const right = percentWithinGrid(segment.endTime, gridStart, gridEnd);
          const task = segment.taskId ? workTasksById.get(segment.taskId) : undefined;
          const label = task?.name ?? "休憩";
          const color = task?.color ?? BREAK_COLOR;
          return (
            <div
              key={segment.id}
              role="button"
              tabIndex={0}
              onPointerDown={(e) => startMove(segment, e)}
              onClick={(e) => e.stopPropagation()}
              className={`group absolute top-0.5 bottom-0.5 flex cursor-grab items-center justify-center overflow-hidden rounded-sm px-1 text-sm font-medium text-zinc-900/80 shadow-sm active:cursor-grabbing ${isActive ? "z-10 ring-2 ring-blue-500" : ""}`}
              style={{ left: `${left}%`, width: `${Math.max(right - left, 0.5)}%`, backgroundColor: color }}
              title={`${label} ${segment.startTime}-${segment.endTime}（クリックで編集、中央をドラッグで並べ替え、端をドラッグで時間変更）`}
            >
              <span className="truncate">{label}</span>
              <div
                onPointerDown={(e) => startResize(segment, "start", e)}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 group-hover:bg-black/20"
              />
              <div
                onPointerDown={(e) => startResize(segment, "end", e)}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 group-hover:bg-black/20"
              />
            </div>
          );
        })}
      </div>
      <div className="flex w-10 shrink-0 items-center justify-center">
        {isCopySource ? (
          <button
            type="button"
            onClick={onCancelCopy}
            title="コピーを解除"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-brand hover:bg-brand/20"
          >
            <XIcon className="h-4 w-4" />
          </button>
        ) : canPaste ? (
          <button
            type="button"
            onClick={onPaste}
            title="貼り付け"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white hover:bg-brand-hover"
          >
            <PasteIcon className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onCopy}
            title="この行をコピー"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
          >
            <CopyIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

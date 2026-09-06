import { useRef, useState } from "react";
import type { PiiEmployee, TaskSegment, WorkTask } from "@shifuto/shared-core";
import { percentWithinGrid, timeAtPercent } from "../../lib/timeGrid";

const BREAK_COLOR = "#e4e4e7"; // zinc-200

type Draft = { segmentId: string; startTime: string; endTime: string };

export function DayGanttRow({
  employee,
  segments,
  workTasksById,
  gridStart,
  gridEnd,
  onAddSegment,
  onEditSegment,
  onResizeSegment,
}: {
  employee: PiiEmployee;
  segments: TaskSegment[];
  workTasksById: Map<WorkTask["id"], WorkTask>;
  gridStart: string;
  gridEnd: string;
  onAddSegment: () => void;
  onEditSegment: (segment: TaskSegment) => void;
  onResizeSegment: (segment: TaskSegment, startTime: string, endTime: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  function startResize(segment: TaskSegment, edge: "start" | "end", e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;

    function handleMove(ev: PointerEvent) {
      const percent = ((ev.clientX - rect!.left) / rect!.width) * 100;
      const time = timeAtPercent(percent, gridStart, gridEnd);
      setDraft((prev) => {
        const base = prev && prev.segmentId === segment.id ? prev : { segmentId: segment.id, startTime: segment.startTime, endTime: segment.endTime };
        if (edge === "start") {
          return time < base.endTime ? { ...base, startTime: time } : base;
        }
        return time > base.startTime ? { ...base, endTime: time } : base;
      });
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setDraft((current) => {
        if (current && current.segmentId === segment.id) {
          onResizeSegment(segment, current.startTime, current.endTime);
        }
        return null;
      });
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <div className="flex items-stretch gap-2 border-b border-zinc-100 py-1.5 last:border-b-0">
      <div className="w-28 shrink-0 truncate py-1.5 text-sm text-zinc-700" title={employee.name}>
        {employee.name}
      </div>
      <div
        ref={trackRef}
        role="button"
        tabIndex={0}
        onClick={onAddSegment}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onAddSegment();
        }}
        className="relative h-9 flex-1 rounded-sm bg-zinc-50 ring-1 ring-inset ring-zinc-200 hover:ring-blue-300"
        title="クリックして時間帯を追加"
      >
        {segments.map((segment) => {
          const isDragging = draft?.segmentId === segment.id;
          const startTime = isDragging ? draft.startTime : segment.startTime;
          const endTime = isDragging ? draft.endTime : segment.endTime;
          const left = percentWithinGrid(startTime, gridStart, gridEnd);
          const right = percentWithinGrid(endTime, gridStart, gridEnd);
          const task = segment.taskId ? workTasksById.get(segment.taskId) : undefined;
          const label = task?.name ?? "休憩";
          const color = task?.color ?? BREAK_COLOR;
          return (
            <div
              key={segment.id}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDragging) onEditSegment(segment);
              }}
              className={`group absolute top-0.5 bottom-0.5 flex items-center justify-center overflow-hidden rounded-sm px-1 text-sm font-medium text-zinc-900/80 shadow-sm ${isDragging ? "z-10 ring-2 ring-blue-500" : ""}`}
              style={{ left: `${left}%`, width: `${Math.max(right - left, 0.5)}%`, backgroundColor: color }}
              title={`${label} ${startTime}-${endTime}（端をドラッグして時間変更）`}
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
    </div>
  );
}

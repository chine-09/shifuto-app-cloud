import type { PiiEmployee, TaskSegment, WorkTask } from "@shifuto/shared-core";
import { percentWithinGrid } from "../../lib/timeGrid";

const BREAK_COLOR = "#e4e4e7"; // zinc-200

export function DayGanttRow({
  employee,
  segments,
  workTasksById,
  gridStart,
  gridEnd,
  onAddSegment,
  onEditSegment,
}: {
  employee: PiiEmployee;
  segments: TaskSegment[];
  workTasksById: Map<WorkTask["id"], WorkTask>;
  gridStart: string;
  gridEnd: string;
  onAddSegment: () => void;
  onEditSegment: (segment: TaskSegment) => void;
}) {
  return (
    <div className="flex items-stretch gap-2 border-b border-zinc-100 py-1.5 last:border-b-0">
      <div className="w-28 shrink-0 truncate py-1.5 text-sm text-zinc-700" title={employee.name}>
        {employee.name}
      </div>
      <button
        type="button"
        onClick={onAddSegment}
        className="relative h-9 flex-1 rounded-sm bg-zinc-50 ring-1 ring-inset ring-zinc-200 hover:ring-blue-300"
        title="クリックして時間帯を追加"
      >
        {segments.map((segment) => {
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
              onClick={(e) => {
                e.stopPropagation();
                onEditSegment(segment);
              }}
              className="absolute top-0.5 bottom-0.5 flex items-center justify-center overflow-hidden rounded-sm px-1 text-sm font-medium text-zinc-900/80 shadow-sm"
              style={{ left: `${left}%`, width: `${Math.max(right - left, 0.5)}%`, backgroundColor: color }}
              title={`${label} ${segment.startTime}-${segment.endTime}`}
            >
              <span className="truncate">{label}</span>
            </div>
          );
        })}
      </button>
    </div>
  );
}

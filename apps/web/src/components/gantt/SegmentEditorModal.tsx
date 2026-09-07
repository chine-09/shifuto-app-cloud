import { useState } from "react";
import { createPortal } from "react-dom";
import type { PlanId, EmployeeId, TaskSegment, WorkTask } from "@shifuto/shared-core";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useAppDispatch, useAppState } from "../../state/AppStateContext";
import { taskSegmentsForDay } from "../../state/selectors";

const BREAK_VALUE = "__break__";

export function SegmentEditorModal({
  planId,
  employeeId,
  date,
  workTasks,
  gridStart,
  gridEnd,
  editingSegment,
  onClose,
}: {
  planId: PlanId;
  employeeId: EmployeeId;
  date: string;
  workTasks: WorkTask[];
  gridStart: string;
  gridEnd: string;
  editingSegment: TaskSegment | null;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const state = useAppState();
  const [taskValue, setTaskValue] = useState<string>(editingSegment ? (editingSegment.taskId ?? BREAK_VALUE) : (workTasks[0]?.id ?? BREAK_VALUE));
  const [startTime, setStartTime] = useState(editingSegment?.startTime ?? gridStart);
  const [endTime, setEndTime] = useState(editingSegment?.endTime ?? gridEnd);
  const [error, setError] = useState<string | null>(null);

  // The employee's other segments for this day — "other" meaning not the
  // one currently being edited, if any (undefined editingSegment?.id when
  // adding a new one excludes nothing, which is what we want). Shared by
  // both save (to check overlap and rebuild the array) and delete.
  const otherSegments = taskSegmentsForDay(state, planId, date).filter(
    (s) => s.employeeId === employeeId && s.id !== editingSegment?.id,
  );

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (startTime >= endTime) {
      setError("開始時刻は終了時刻より前にしてください。");
      return;
    }

    const overlaps = otherSegments.some((s) => startTime < s.endTime && endTime > s.startTime);
    if (overlaps) {
      setError("他の作業・休憩の時間帯と重なっています。");
      return;
    }

    const segment: TaskSegment = {
      id: editingSegment?.id ?? crypto.randomUUID(),
      planId,
      employeeId,
      date,
      taskId: taskValue === BREAK_VALUE ? null : (taskValue as TaskSegment["taskId"]),
      startTime,
      endTime,
    };
    dispatch({
      type: "REPLACE_TASK_SEGMENTS_FOR_DAY",
      planId,
      employeeId,
      date,
      segments: [...otherSegments, segment],
    });
    onClose();
  }

  function handleDelete() {
    if (!editingSegment) return;
    dispatch({ type: "REPLACE_TASK_SEGMENTS_FOR_DAY", planId, employeeId, date, segments: otherSegments });
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="z-50 flex w-80 flex-col gap-3 rounded-md border border-zinc-300 bg-white p-4 shadow-lg"
      >
        <h3 className="text-base font-semibold text-zinc-700">{editingSegment ? "時間帯を編集" : "時間帯を追加"}</h3>

        <label className="flex flex-col gap-1 text-sm text-zinc-500">
          作業・休憩
          <select
            value={taskValue}
            onChange={(e) => setTaskValue(e.target.value)}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-base"
          >
            {workTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value={BREAK_VALUE}>休憩</option>
          </select>
        </label>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-500">
            開始時刻
            <Input type="time" step={900} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-500">
            終了時刻
            <Input type="time" step={900} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="submit">保存</Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              キャンセル
            </Button>
          </div>
          {editingSegment && (
            <button type="button" onClick={handleDelete} className="text-sm text-red-600 hover:underline">
              この時間帯を削除
            </button>
          )}
        </div>
      </form>
    </div>,
    document.body,
  );
}

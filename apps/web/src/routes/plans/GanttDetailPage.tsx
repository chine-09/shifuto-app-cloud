import { useMemo, useState } from "react";
import { daysInMonth, toDateKey, type EmployeeId, type TaskSegment } from "@shifuto/shared-core";
import { useAppDispatch, useAppState } from "../../state/AppStateContext";
import { activeEmployees, taskSegmentsForDay } from "../../state/selectors";
import { WorkTaskManager } from "../../components/gantt/WorkTaskManager";
import { DayGanttRow } from "../../components/gantt/DayGanttRow";
import { SegmentEditorModal } from "../../components/gantt/SegmentEditorModal";
import { Input } from "../../components/ui/Input";
import { buildTimeTicks } from "../../lib/timeGrid";
import { resizeSegmentWithNeighbors } from "../../lib/gantt/resizeSegment";
import { usePlanContext } from "./usePlanContext";

type EditorTarget = { employeeId: EmployeeId; segment: TaskSegment | null };

/**
 * The detailed, 15-minute-resolution Gantt view for a single day — the
 * fine-grained task/break breakdown from the reference photo. Intentionally
 * separate from the simple shift table (ShiftsPage): both read/write the
 * same AppState, but this view edits `taskSegments` (see
 * REPLACE_TASK_SEGMENTS_FOR_DAY in appReducer.ts) while the simple table
 * edits `assignedShifts` directly. Cross-store "応援" support is out of
 * scope for now — see docs/SPEC.md.
 */
export function GanttDetailPage() {
  const { planId, plan } = usePlanContext();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const employees = activeEmployees(state);
  const monthDates = useMemo(() => daysInMonth(plan.year, plan.month), [plan.year, plan.month]);

  const [date, setDate] = useState(() => toDateKey(monthDates[0]));
  const [gridStart, setGridStart] = useState("08:00");
  const [gridEnd, setGridEnd] = useState("22:00");
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);

  const segments = taskSegmentsForDay(state, planId, date);
  const workTasksById = useMemo(() => new Map(state.workTasks.map((t) => [t.id, t])), [state.workTasks]);
  const hourTicks = useMemo(
    () => buildTimeTicks(gridStart, gridEnd).filter((t) => t.endsWith(":00")),
    [gridStart, gridEnd],
  );

  function handleResizeSegment(segment: TaskSegment, startTime: string, endTime: string) {
    const employeeSegments = segments.filter((s) => s.employeeId === segment.employeeId);
    const updated = resizeSegmentWithNeighbors(employeeSegments, segment.id, startTime, endTime);
    if (!updated) return; // invalid (inverted or overlaps a non-adjacent segment) — bar snaps back on drop

    dispatch({ type: "REPLACE_TASK_SEGMENTS_FOR_DAY", planId, employeeId: segment.employeeId, date, segments: updated });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-zinc-200 bg-white p-3">
        <h2 className="mb-2 text-base font-semibold text-zinc-700">作業種別マスタ</h2>
        <WorkTaskManager workTasks={state.workTasks} />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            日付
            <Input
              type="date"
              value={date}
              min={toDateKey(monthDates[0])}
              max={toDateKey(monthDates[monthDates.length - 1])}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            表示開始
            <Input type="time" value={gridStart} onChange={(e) => setGridStart(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            表示終了
            <Input type="time" value={gridEnd} onChange={(e) => setGridEnd(e.target.value)} />
          </label>
        </div>

        {employees.length === 0 ? (
          <p className="text-sm text-zinc-500">従業員が登録されていません。</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="flex gap-2 border-b border-zinc-200 pb-1 text-sm text-zinc-400">
                <div className="w-28 shrink-0" />
                <div className="relative flex-1">
                  {hourTicks.map((tick) => (
                    <span
                      key={tick}
                      className="absolute -translate-x-1/2"
                      style={{ left: `${(hourTicks.indexOf(tick) / hourTicks.length) * 100}%` }}
                    >
                      {tick.slice(0, 2)}時
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                {employees.map((employee) => (
                  <DayGanttRow
                    key={employee.id}
                    employee={employee}
                    segments={segments.filter((s) => s.employeeId === employee.id)}
                    workTasksById={workTasksById}
                    gridStart={gridStart}
                    gridEnd={gridEnd}
                    onAddSegment={() => setEditorTarget({ employeeId: employee.id, segment: null })}
                    onEditSegment={(segment) => setEditorTarget({ employeeId: employee.id, segment })}
                    onResizeSegment={handleResizeSegment}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <p className="mt-2 text-sm text-zinc-400">
          行をクリックすると15分単位で時間帯を追加できます。既存の色付きバーはクリックで編集・削除、端をドラッグすると時間を変更できます。
        </p>
      </section>

      {editorTarget && (
        <SegmentEditorModal
          planId={planId}
          employeeId={editorTarget.employeeId}
          date={date}
          workTasks={state.workTasks}
          gridStart={gridStart}
          gridEnd={gridEnd}
          editingSegment={editorTarget.segment}
          onClose={() => setEditorTarget(null)}
        />
      )}
    </div>
  );
}

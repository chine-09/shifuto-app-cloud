import { useEffect, useMemo, useState } from "react";
import { daysInMonth, toDateKey, type EmployeeId, type TaskSegment } from "@shifuto/shared-core";
import { useAppDispatch, useAppState } from "../../state/AppStateContext";
import { activeEmployees, taskSegmentsForDay } from "../../state/selectors";
import { WorkTaskManager, type QuickAddSelection } from "../../components/gantt/WorkTaskManager";
import { DayGanttRow } from "../../components/gantt/DayGanttRow";
import { SegmentEditorModal } from "../../components/gantt/SegmentEditorModal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { buildTimeTicks } from "../../lib/timeGrid";
import { resizeSegmentWithNeighbors } from "../../lib/gantt/resizeSegment";
import { computeQuickAddEnd } from "../../lib/gantt/quickAddSegment";
import { exportGanttDayXlsx } from "../../lib/export/exportGanttDayXlsx";
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
  const allActiveEmployees = activeEmployees(state);
  const monthDates = useMemo(() => daysInMonth(plan.year, plan.month), [plan.year, plan.month]);

  const [date, setDate] = useState(() => toDateKey(monthDates[0]));
  const [gridStart, setGridStart] = useState("08:00");
  const [gridEnd, setGridEnd] = useState("22:00");
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copiedFrom, setCopiedFrom] = useState<EmployeeId | null>(null);
  const [quickAddSelection, setQuickAddSelection] = useState<QuickAddSelection>(null);

  useEffect(() => {
    if (!copiedFrom && !quickAddSelection) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCopiedFrom(null);
        setQuickAddSelection(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copiedFrom, quickAddSelection]);

  const segments = taskSegmentsForDay(state, planId, date);
  // The daily Gantt is for building out the shift of people already scheduled
  // that day (via the monthly shift table) — showing everyone active,
  // scheduled or not, made it look like unscheduled staff were working.
  const scheduledEmployeeIds = useMemo(
    () =>
      new Set(
        state.assignedShifts
          .filter((s) => s.planId === planId && s.date === date && s.shiftType === "work")
          .map((s) => s.employeeId),
      ),
    [state.assignedShifts, planId, date],
  );
  const employees = allActiveEmployees.filter((e) => scheduledEmployeeIds.has(e.id));
  const workTasksById = useMemo(() => new Map(state.workTasks.map((t) => [t.id, t])), [state.workTasks]);
  const segmentsByEmployee = useMemo(() => {
    const map = new Map<EmployeeId, TaskSegment[]>();
    for (const s of segments) {
      const list = map.get(s.employeeId) ?? [];
      list.push(s);
      map.set(s.employeeId, list);
    }
    return map;
  }, [segments]);
  const hourTicks = useMemo(
    () => buildTimeTicks(gridStart, gridEnd).filter((t) => t.endsWith(":00")),
    [gridStart, gridEnd],
  );

  function handleResizeSegment(segment: TaskSegment, startTime: string, endTime: string) {
    const employeeSegments = segmentsByEmployee.get(segment.employeeId) ?? [];
    const updated = resizeSegmentWithNeighbors(employeeSegments, segment.id, startTime, endTime);
    if (!updated) return; // invalid (inverted or overlaps a non-adjacent segment) — bar snaps back on drop

    dispatch({ type: "REPLACE_TASK_SEGMENTS_FOR_DAY", planId, employeeId: segment.employeeId, date, segments: updated });
  }

  function handleReorderSegments(employeeId: EmployeeId, reordered: TaskSegment[]) {
    dispatch({ type: "REPLACE_TASK_SEGMENTS_FOR_DAY", planId, employeeId, date, segments: reordered });
  }

  function handlePaste(targetEmployeeId: EmployeeId) {
    if (!copiedFrom) return;
    const sourceSegments = segmentsByEmployee.get(copiedFrom) ?? [];
    const pasted = sourceSegments.map((s) => ({ ...s, id: crypto.randomUUID(), employeeId: targetEmployeeId }));
    dispatch({ type: "REPLACE_TASK_SEGMENTS_FOR_DAY", planId, employeeId: targetEmployeeId, date, segments: pasted });
  }

  function handleQuickAdd(employeeId: EmployeeId, startTime: string) {
    if (!quickAddSelection) return;
    const employeeSegments = segmentsByEmployee.get(employeeId) ?? [];
    const endTime = computeQuickAddEnd(employeeSegments, startTime, gridEnd);
    if (!endTime) return; // clicked spot has no room for even a short segment — no-op
    const newSegment: TaskSegment = {
      id: crypto.randomUUID(),
      planId,
      employeeId,
      date,
      taskId: quickAddSelection.taskId,
      startTime,
      endTime,
    };
    dispatch({
      type: "REPLACE_TASK_SEGMENTS_FOR_DAY",
      planId,
      employeeId,
      date,
      segments: [...employeeSegments, newSegment],
    });
  }

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    setExportMessage(null);
    try {
      await exportGanttDayXlsx({
        storeName: state.meta.storeName,
        date,
        employees,
        segments,
        workTasks: state.workTasks,
        gridStart,
        gridEnd,
      });
      setExportMessage("✓ ダウンロードフォルダに出力しました");
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-700">作業種別マスタ（クリックして選択）</h2>
          {quickAddSelection && (
            <span className="rounded-full bg-brand-light px-3 py-1 text-sm font-medium text-brand">
              「{quickAddSelection.taskId ? (workTasksById.get(quickAddSelection.taskId)?.name ?? "") : "休憩"}」を入力中 (Escで解除)
            </span>
          )}
        </div>
        <WorkTaskManager
          workTasks={state.workTasks}
          quickAddSelection={quickAddSelection}
          onSelectQuickAdd={(selection) => {
            setQuickAddSelection(selection);
            setCopiedFrom(null);
          }}
        />
      </section>

      <section className="card p-3">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            日付
            <Input
              type="date"
              value={date}
              min={toDateKey(monthDates[0])}
              max={toDateKey(monthDates[monthDates.length - 1])}
              onChange={(e) => {
                setDate(e.target.value);
                setCopiedFrom(null);
                setQuickAddSelection(null);
              }}
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
          <Button type="button" variant="secondary" onClick={handleExport} disabled={isExporting || employees.length === 0}>
            {isExporting ? "出力中..." : "Excelに出力"}
          </Button>
          {exportMessage && <span className="text-sm text-green-600">{exportMessage}</span>}
          {exportError && <span className="text-sm text-red-600">{exportError}</span>}
        </div>

        {allActiveEmployees.length === 0 ? (
          <p className="text-sm text-zinc-500">従業員が登録されていません。</p>
        ) : employees.length === 0 ? (
          <p className="text-sm text-zinc-500">
            この日は「月間シフト」で出勤が登録されている従業員がいません。先に月間シフトで出退勤を登録してください。
          </p>
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
                <div className="w-10 shrink-0 text-center">操作</div>
              </div>
              <div className="mt-3">
                {employees.map((employee) => (
                  <DayGanttRow
                    key={employee.id}
                    employee={employee}
                    segments={segmentsByEmployee.get(employee.id) ?? []}
                    workTasksById={workTasksById}
                    gridStart={gridStart}
                    gridEnd={gridEnd}
                    onAddSegment={() => setEditorTarget({ employeeId: employee.id, segment: null })}
                    onEditSegment={(segment) => setEditorTarget({ employeeId: employee.id, segment })}
                    onResizeSegment={handleResizeSegment}
                    onReorderSegments={(reordered) => handleReorderSegments(employee.id, reordered)}
                    isCopySource={employee.id === copiedFrom}
                    canPaste={copiedFrom !== null && employee.id !== copiedFrom}
                    onCopy={() => {
                      setCopiedFrom(employee.id);
                      setQuickAddSelection(null);
                    }}
                    onCancelCopy={() => setCopiedFrom(null)}
                    onPaste={() => handlePaste(employee.id)}
                    quickAddActive={quickAddSelection !== null}
                    onQuickAdd={(startTime) => handleQuickAdd(employee.id, startTime)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <p className="mt-2 text-sm text-zinc-400">
          行をクリックすると15分単位で時間帯を追加できます。既存の色付きバーはクリックで編集・削除、端をドラッグすると時間を変更、中央をドラッグすると隣の時間帯と順番を入れ替えられます。
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

      {copiedFrom && (
        <div className="fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg">
          <span className="text-brand-light">✓</span>
          <span>
            {employees.find((e) => e.id === copiedFrom)?.name ?? ""}のシフトを保持しました。Escキーで解除します。
          </span>
        </div>
      )}
    </div>
  );
}

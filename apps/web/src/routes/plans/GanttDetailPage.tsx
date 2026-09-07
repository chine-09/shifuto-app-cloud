import { useEffect, useMemo, useState } from "react";
import { daysInMonth, toDateKey, type EmployeeId, type TaskSegment } from "@shifuto/shared-core";
import { useAppDispatch, useAppState } from "../../state/AppStateContext";
import { activeEmployees, taskSegmentsForDay } from "../../state/selectors";
import { WorkTaskManager } from "../../components/gantt/WorkTaskManager";
import { DayGanttRow } from "../../components/gantt/DayGanttRow";
import { SegmentEditorModal } from "../../components/gantt/SegmentEditorModal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { buildTimeTicks } from "../../lib/timeGrid";
import { resizeSegmentWithNeighbors } from "../../lib/gantt/resizeSegment";
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
  const employees = activeEmployees(state);
  const monthDates = useMemo(() => daysInMonth(plan.year, plan.month), [plan.year, plan.month]);

  const [date, setDate] = useState(() => toDateKey(monthDates[0]));
  const [gridStart, setGridStart] = useState("08:00");
  const [gridEnd, setGridEnd] = useState("22:00");
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copiedFrom, setCopiedFrom] = useState<EmployeeId | null>(null);

  useEffect(() => {
    if (!copiedFrom) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCopiedFrom(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copiedFrom]);

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

  function handleReorderSegments(employeeId: EmployeeId, reordered: TaskSegment[]) {
    dispatch({ type: "REPLACE_TASK_SEGMENTS_FOR_DAY", planId, employeeId, date, segments: reordered });
  }

  function handlePaste(targetEmployeeId: EmployeeId) {
    if (!copiedFrom) return;
    const sourceSegments = segments.filter((s) => s.employeeId === copiedFrom);
    const pasted = sourceSegments.map((s) => ({ ...s, id: crypto.randomUUID(), employeeId: targetEmployeeId }));
    dispatch({ type: "REPLACE_TASK_SEGMENTS_FOR_DAY", planId, employeeId: targetEmployeeId, date, segments: pasted });
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
        <h2 className="mb-2 text-base font-semibold text-zinc-700">作業種別マスタ</h2>
        <WorkTaskManager workTasks={state.workTasks} />
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
                <div className="w-10 shrink-0 text-center">操作</div>
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
                    onReorderSegments={(reordered) => handleReorderSegments(employee.id, reordered)}
                    isCopySource={employee.id === copiedFrom}
                    canPaste={copiedFrom !== null && employee.id !== copiedFrom}
                    onCopy={() => setCopiedFrom(employee.id)}
                    onCancelCopy={() => setCopiedFrom(null)}
                    onPaste={() => handlePaste(employee.id)}
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

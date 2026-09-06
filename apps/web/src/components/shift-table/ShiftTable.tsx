import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  asEmployeeId,
  computeShiftHours,
  daysInMonth,
  toDateKey,
  weekdayOf,
  WEEKDAY_LABELS_JA,
  type AssignedShift,
  type PlanId,
  type ShiftType,
} from "@shifuto/shared-core";
import { useAppDispatch, useAppState, useCanUndo } from "../../state/AppStateContext";
import {
  activeEmployees,
  employeesById,
  headcountForPlan,
  leavesForPlan,
  planById,
  requiredCountByDate as computeRequiredCountByDate,
  shiftsForPlan,
  violationsForPlan,
} from "../../state/selectors";
import { ShiftCell, type CellValue } from "./ShiftCell";
import { BulkShiftForm } from "./BulkShiftForm";
import { ViolationsPanel } from "../violations/ViolationsPanel";
import { Button } from "../ui/Button";
import { exportShiftsXlsx } from "../../lib/export/exportShiftsXlsx";
import { buildViolationMessage } from "../../lib/violationMessages";
import { anonymizeEmployees } from "../../lib/anonymize";
import { autoAssignShifts as callAutoAssignShifts } from "../../lib/api/lambdaClient";
import { rehydrateAssignedShifts } from "../../lib/rehydrate";

type ShiftMap = Map<string, Map<string, AssignedShift>>; // employeeId -> dateKey -> shift

type FillDrag = {
  sourceEmployeeId: string;
  sourceDateKey: string;
  value: CellValue;
  axis: "row" | "col" | null;
  targetKeys: Set<string>;
};

function buildMap(shifts: AssignedShift[]): ShiftMap {
  const map: ShiftMap = new Map();
  for (const shift of shifts) {
    const byDate = map.get(shift.employeeId) ?? new Map<string, AssignedShift>();
    byDate.set(shift.date, shift);
    map.set(shift.employeeId, byDate);
  }
  return map;
}

export function ShiftTable({ planId }: { planId: PlanId }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const canUndo = useCanUndo();

  const plan = planById(state, planId);
  const employees = activeEmployees(state);
  const shifts = shiftsForPlan(state, planId);
  const violations = violationsForPlan(state, planId);
  const requiredCountByDate = computeRequiredCountByDate(headcountForPlan(state, planId));
  const empById = employeesById(state);

  const [showBulkForm, setShowBulkForm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCell, setOpenCell] = useState<{ key: string; anchor: DOMRect } | null>(null);
  const [fillDrag, setFillDrag] = useState<FillDrag | null>(null);
  const fillDragRef = useRef<FillDrag | null>(null);

  const dates = useMemo(
    () => (plan ? daysInMonth(plan.year, plan.month) : []),
    [plan],
  );
  const dateKeys = useMemo(() => dates.map(toDateKey), [dates]);
  const shiftMap = useMemo(() => buildMap(shifts), [shifts]);

  const employeeIndexById = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach((e, i) => map.set(e.id, i));
    return map;
  }, [employees]);

  const dateIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    dateKeys.forEach((dk, i) => map.set(dk, i));
    return map;
  }, [dateKeys]);

  const violationsByCell = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const v of violations) {
      if (!v.employeeId || !v.date) continue;
      const key = `${v.employeeId}_${v.date}`;
      const list = map.get(key) ?? [];
      list.push(buildViolationMessage(v, empById.get(v.employeeId)?.name));
      map.set(key, list);
    }
    return map;
  }, [violations, empById]);

  function saveCell(
    employeeId: string,
    dateKey: string,
    next: { shiftType: ShiftType; startTime: string | null; endTime: string | null },
  ) {
    if (next.shiftType === "work" && next.startTime && next.endTime && next.startTime >= next.endTime) {
      setError("開始時刻は終了時刻より前である必要があります");
      return;
    }
    setError(null);
    dispatch({
      type: "UPSERT_SHIFT",
      shift: {
        employeeId: asEmployeeId(employeeId),
        planId,
        date: dateKey,
        shiftType: next.shiftType,
        startTime: next.startTime,
        endTime: next.endTime,
        hours: computeShiftHours(next.shiftType, next.startTime, next.endTime),
      },
    });
  }

  function clearCell(employeeId: string, dateKey: string) {
    setError(null);
    dispatch({ type: "CLEAR_SHIFT", planId, employeeId: asEmployeeId(employeeId), date: dateKey });
  }

  function startFill(employeeId: string, dateKey: string, value: CellValue) {
    setOpenCell(null);
    setFillDrag({ sourceEmployeeId: employeeId, sourceDateKey: dateKey, value, axis: null, targetKeys: new Set() });
  }

  function commitFill(drag: FillDrag) {
    const { sourceEmployeeId, sourceDateKey, value, axis, targetKeys } = drag;
    if (!axis || targetKeys.size === 0) return;
    setError(null);

    if (axis === "col") {
      const targetDates = dateKeys.filter((dk) => targetKeys.has(`${sourceEmployeeId}_${dk}`));
      if (value) {
        dispatch({
          type: "BULK_UPSERT_SHIFTS",
          shifts: targetDates.map((date) => ({
            employeeId: asEmployeeId(sourceEmployeeId),
            planId,
            date,
            shiftType: value.shiftType,
            startTime: value.startTime,
            endTime: value.endTime,
            hours: computeShiftHours(value.shiftType, value.startTime, value.endTime),
          })),
        });
      } else {
        dispatch({
          type: "BULK_CLEAR_SHIFTS",
          planId,
          targets: targetDates.map((date) => ({ employeeId: asEmployeeId(sourceEmployeeId), date })),
        });
      }
    } else {
      const targetEmployeeIds = employees.map((e) => e.id).filter((id) => targetKeys.has(`${id}_${sourceDateKey}`));
      if (value) {
        dispatch({
          type: "BULK_UPSERT_SHIFTS",
          shifts: targetEmployeeIds.map((employeeId) => ({
            employeeId,
            planId,
            date: sourceDateKey,
            shiftType: value.shiftType,
            startTime: value.startTime,
            endTime: value.endTime,
            hours: computeShiftHours(value.shiftType, value.startTime, value.endTime),
          })),
        });
      } else {
        dispatch({
          type: "BULK_CLEAR_SHIFTS",
          planId,
          targets: targetEmployeeIds.map((employeeId) => ({ employeeId, date: sourceDateKey })),
        });
      }
    }
  }

  useEffect(() => {
    fillDragRef.current = fillDrag;
  }, [fillDrag]);

  useEffect(() => {
    if (!fillDrag) return;

    function handlePointerMove(e: PointerEvent) {
      const current = fillDragRef.current;
      if (!current) return;

      const cellEl = (e.target as HTMLElement | null)
        ?.ownerDocument?.elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-employee-id]");
      if (!cellEl) return;

      const hoveredEmployeeId = cellEl.dataset.employeeId;
      const hoveredDateKey = cellEl.dataset.dateKey;
      if (!hoveredEmployeeId || !hoveredDateKey) return;

      const srcEmpIdx = employeeIndexById.get(current.sourceEmployeeId);
      const srcDateIdx = dateIndexByKey.get(current.sourceDateKey);
      const hovEmpIdx = employeeIndexById.get(hoveredEmployeeId);
      const hovDateIdx = dateIndexByKey.get(hoveredDateKey);
      if (srcEmpIdx === undefined || srcDateIdx === undefined || hovEmpIdx === undefined || hovDateIdx === undefined) {
        return;
      }

      let axis = current.axis;
      if (!axis) {
        const dEmp = Math.abs(hovEmpIdx - srcEmpIdx);
        const dDate = Math.abs(hovDateIdx - srcDateIdx);
        if (dEmp === 0 && dDate === 0) return;
        axis = dDate >= dEmp ? "col" : "row";
      }

      const targetKeys = new Set<string>();
      if (axis === "col") {
        const lo = Math.min(srcDateIdx, hovDateIdx);
        const hi = Math.max(srcDateIdx, hovDateIdx);
        for (let i = lo; i <= hi; i++) {
          const dk = dateKeys[i];
          if (dk === current.sourceDateKey) continue;
          targetKeys.add(`${current.sourceEmployeeId}_${dk}`);
        }
      } else {
        const lo = Math.min(srcEmpIdx, hovEmpIdx);
        const hi = Math.max(srcEmpIdx, hovEmpIdx);
        for (let i = lo; i <= hi; i++) {
          const emp = employees[i];
          if (emp.id === current.sourceEmployeeId) continue;
          targetKeys.add(`${emp.id}_${current.sourceDateKey}`);
        }
      }

      setFillDrag((prev) => (prev ? { ...prev, axis, targetKeys } : prev));
    }

    function handlePointerUp() {
      const current = fillDragRef.current;
      setFillDrag(null);
      if (current) commitFill(current);
    }

    document.body.style.userSelect = "none";
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.body.style.userSelect = "";
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillDrag !== null]);

  const dailyTotals = dateKeys.map((dateKey) =>
    employees.reduce((sum, emp) => sum + (shiftMap.get(emp.id)?.get(dateKey)?.hours ?? 0), 0),
  );
  const employeeTotals = employees.map((emp) => {
    const byDate = shiftMap.get(emp.id);
    if (!byDate) return 0;
    let total = 0;
    for (const shift of byDate.values()) total += shift.hours;
    return total;
  });

  async function handleExport() {
    if (!plan) return;
    setIsExporting(true);
    setExportMessage(null);
    try {
      await exportShiftsXlsx({
        storeName: state.meta.storeName,
        year: plan.year,
        month: plan.month,
        employees,
        dateKeys,
        shiftsByEmployeeDate: shiftMap,
        requiredCountByDate,
        dailyTotals,
        employeeTotals,
      });
      setExportMessage("✓ ダウンロードフォルダに出力しました");
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleAutoAssign() {
    if (!plan) return;
    const requirements = headcountForPlan(state, planId);
    if (requirements.length === 0) {
      setError('必要人数が設定されていません。先に「必要人数設定」タブで設定してください。');
      return;
    }
    if (shifts.length > 0 && !confirm("既存のシフトを上書きして自動割当を実行します。よろしいですか？")) {
      return;
    }
    setError(null);
    setIsAutoAssigning(true);
    try {
      const response = await callAutoAssignShifts({
        planId,
        employees: anonymizeEmployees(employees),
        requestedLeaves: leavesForPlan(state, planId).map(({ employeeId, date }) => ({ employeeId, date })),
        headcountRequirements: headcountForPlan(state, planId),
        workRule: state.workRule,
        dateRange: { start: dateKeys[0], end: dateKeys[dateKeys.length - 1] },
      });
      dispatch({
        type: "REPLACE_SHIFTS_FOR_PLAN",
        planId,
        shifts: rehydrateAssignedShifts(response.assignedShifts, planId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "自動割当に失敗しました");
    } finally {
      setIsAutoAssigning(false);
    }
  }

  if (!plan) {
    return <p className="text-sm text-zinc-500">シフト計画が見つかりません。</p>;
  }
  if (employees.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-base text-zinc-600">
        先に<Link to="/employees" className="text-blue-600 hover:underline">「従業員」画面</Link>で従業員を登録してください。
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Button type="button" variant="secondary" onClick={() => setShowBulkForm((v) => !v)}>
            1人分をまとめて登録
          </Button>
          {showBulkForm && (
            <BulkShiftForm planId={planId} employees={employees} onClose={() => setShowBulkForm(false)} />
          )}
        </div>
        <Button type="button" variant="secondary" onClick={handleExport} disabled={isExporting}>
          {isExporting ? "出力中..." : "Excelに出力"}
        </Button>
        <Button
          type="button"
          onClick={handleAutoAssign}
          disabled={isAutoAssigning}
          title="必要人数・希望休・勤務ルールをもとに、シフトのたたき台を自動生成します"
        >
          {isAutoAssigning ? "計算中..." : "自動割当"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => dispatch({ type: "UNDO" })}
          disabled={!canUndo}
          title="直前の変更を元に戻します"
        >
          元に戻す
        </Button>
        {exportMessage && <span className="text-sm text-green-600">{exportMessage}</span>}
      </div>
      <p className="text-sm text-zinc-500">
        セルをクリックすると勤務時間・有休・休を編集できます。赤枠のセルは制約違反があります。「自動割当」は必要人数・希望休・
        <Link to="/settings" className="text-blue-600 hover:underline">
          勤務ルール
        </Link>
        をもとにたたき台を作成します。
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-[9rem] border border-zinc-200 bg-zinc-50 px-2 py-1 text-left">
                従業員
              </th>
              {dates.map((date, i) => {
                const wd = weekdayOf(date);
                const bg = wd === 6 ? "bg-blue-100" : wd === 0 ? "bg-pink-100" : "bg-zinc-50";
                return (
                  <th
                    key={dateKeys[i]}
                    className={`sticky top-0 z-20 min-w-[5.5rem] border border-zinc-200 px-1 py-1 text-center font-normal ${bg}`}
                  >
                    <div>
                      {date.getDate()}({WEEKDAY_LABELS_JA[wd]})
                    </div>
                    <div className="text-sm font-medium text-zinc-700">必要{requiredCountByDate.get(dateKeys[i]) ?? 0}人</div>
                  </th>
                );
              })}
              <th className="sticky top-0 z-20 min-w-[4rem] border border-zinc-200 bg-zinc-50 px-1 py-1 text-center">
                合計(h)
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, empIdx) => (
              <tr key={employee.id}>
                <td
                  className="sticky left-0 z-10 max-w-[9rem] truncate overflow-hidden whitespace-nowrap border border-zinc-200 bg-white px-2 py-1 font-medium text-zinc-800"
                  title={employee.role ? `${employee.name}（${employee.role}）` : employee.name}
                >
                  {employee.name}
                  {employee.role && <span className="ml-1 text-sm text-zinc-400">{employee.role}</span>}
                </td>
                {dateKeys.map((dateKey) => {
                  const cellValue: CellValue = shiftMap.get(employee.id)?.get(dateKey) ?? null;
                  const cellViolations = violationsByCell.get(`${employee.id}_${dateKey}`) ?? [];
                  const cellKey = `${employee.id}_${dateKey}`;
                  return (
                    <td
                      key={dateKey}
                      data-employee-id={employee.id}
                      data-date-key={dateKey}
                      className="relative border border-zinc-200 p-0"
                    >
                      <ShiftCell
                        employeeId={employee.id}
                        date={dateKey}
                        value={cellValue}
                        violationMessages={cellViolations}
                        editable
                        editing={openCell?.key === cellKey}
                        anchor={openCell?.key === cellKey ? openCell.anchor : null}
                        fillPreview={fillDrag?.targetKeys.has(cellKey) ?? false}
                        onOpen={(anchor) => setOpenCell({ key: cellKey, anchor })}
                        onClose={() => setOpenCell(null)}
                        onSave={(next) => saveCell(employee.id, dateKey, next)}
                        onClear={() => clearCell(employee.id, dateKey)}
                        onFillHandleMouseDown={() => startFill(employee.id, dateKey, cellValue)}
                      />
                    </td>
                  );
                })}
                <td className="border border-zinc-200 px-1 py-1 text-center font-medium">
                  {employeeTotals[empIdx].toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 px-2 py-1 font-medium">合計(h)</td>
              {dailyTotals.map((total, i) => (
                <td key={dateKeys[i]} className="border border-zinc-200 px-1 py-1 text-center font-medium">
                  {total.toFixed(2)}
                </td>
              ))}
              <td className="border border-zinc-200 bg-zinc-50" />
            </tr>
          </tfoot>
        </table>
      </div>

      <ViolationsPanel violations={violations} employeesById={empById} />
    </div>
  );
}

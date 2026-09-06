import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  asEmployeeId,
  computeShiftHours,
  resolveDatesInRange,
  WEEKDAY_LABELS_JA,
  type PiiEmployee,
  type PlanId,
  type ShiftType,
} from "@shifuto/shared-core";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useAppDispatch } from "../../state/AppStateContext";

export function BulkShiftForm({
  planId,
  employees,
  onClose,
}: {
  planId: PlanId;
  employees: PiiEmployee[];
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [employeeId, setEmployeeId] = useState<string>(employees[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [shiftType, setShiftType] = useState<ShiftType>("work");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [message, setMessage] = useState<string | null>(null);

  const previewDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    return resolveDatesInRange(startDate, endDate, weekdays);
  }, [startDate, endDate, weekdays]);

  function toggleWeekday(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!employeeId) {
      setMessage("従業員を選択してください。");
      return;
    }
    if (previewDates.length === 0) {
      setMessage("対象日付がありません。日付範囲と曜日を確認してください。");
      return;
    }
    if (shiftType === "work" && startTime >= endTime) {
      setMessage("開始時刻は終了時刻より前である必要があります。");
      return;
    }
    if (!confirm(`${previewDates.length}日分のシフトを一括登録します。既存のシフトは上書きされます。よろしいですか？`)) {
      return;
    }

    const start = shiftType === "work" ? startTime : null;
    const end = shiftType === "work" ? endTime : null;
    dispatch({
      type: "BULK_UPSERT_SHIFTS",
      shifts: previewDates.map((date) => ({
        employeeId: asEmployeeId(employeeId),
        planId,
        date,
        shiftType,
        startTime: start,
        endTime: end,
        hours: computeShiftHours(shiftType, start, end),
      })),
    });
    setMessage(`${previewDates.length}日分のシフトを登録しました。`);
  }

  return (
    <>
      {/* Dims the rest of the page so the shift table and violations list
          behind this panel don't read as still "in front" of it. */}
      {createPortal(
        <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />,
        document.body,
      )}
      {/* Above the shift table's sticky header cells (which also use z-30),
          so this panel isn't fought for stacking order by whichever paints last. */}
      <div className="absolute left-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-md border border-zinc-300 bg-white p-4 shadow-lg">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-700">1人分をまとめて登録</h3>
        <button type="button" onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-700">
          閉じる
        </button>
      </div>
      <p className="mb-3 text-sm text-zinc-500">選んだ1人分について、日付範囲・曜日で絞り込んでまとめて登録します。</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-zinc-500">
          対象従業員
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-base"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-500">
            開始日
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-500">
            終了日
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
        </div>

        <div>
          <p className="mb-1 text-sm text-zinc-500">対象曜日（絞り込み）</p>
          <div className="flex gap-1.5">
            {WEEKDAY_LABELS_JA.map((label, day) => (
              <label
                key={day}
                className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border text-sm ${
                  weekdays.includes(day) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-400"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={weekdays.includes(day)} onChange={() => toggleWeekday(day)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-1">
          {(["work", "leave", "off"] as ShiftType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setShiftType(t)}
              className={`rounded px-2 py-1 text-sm ${shiftType === t ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
            >
              {t === "work" ? "勤務" : t === "leave" ? "有休" : "休"}
            </button>
          ))}
        </div>

        {shiftType === "work" && (
          <div className="flex items-center gap-1 text-sm">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            〜
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        )}

        <p className="text-sm text-zinc-500">
          {previewDates.length > 0 ? `${previewDates.length}日が対象になります` : "日付範囲を選択してください"}
        </p>

        <div className="flex items-center gap-3">
          <Button type="submit">一括登録</Button>
          {message && <span className="text-sm text-zinc-600">{message}</span>}
        </div>
      </form>
      </div>
    </>
  );
}

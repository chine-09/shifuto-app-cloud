import { useMemo, useState } from "react";
import { daysInMonth, resolveDatesInRange, toDateKey, WEEKDAY_LABELS_JA, type HeadcountRequirement, type PlanId } from "@shifuto/shared-core";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { HeadcountCalendar } from "./HeadcountCalendar";
import { useAppDispatch, useAppState, useCanUndo } from "../../state/AppStateContext";
import { headcountForPlan } from "../../state/selectors";

export function HeadcountBulkForm({ planId, year, month }: { planId: PlanId; year: number; month: number }) {
  const dispatch = useAppDispatch();
  const canUndo = useCanUndo();
  const rows = headcountForPlan(useAppState(), planId);

  const monthDates = useMemo(() => daysInMonth(year, month), [year, month]);
  const [startDate, setStartDate] = useState(() => toDateKey(monthDates[0]));
  const [endDate, setEndDate] = useState(() => toDateKey(monthDates[monthDates.length - 1]));
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [requiredCount, setRequiredCount] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const previewDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    return resolveDatesInRange(startDate, endDate, weekdays);
  }, [startDate, endDate, weekdays]);

  function toggleWeekday(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function existingSlotId(date: string, start: string, end: string): string | null {
    const found = rows.find((r) => r.date === date && r.startTime.slice(0, 5) === start && r.endTime.slice(0, 5) === end);
    return found?.id ?? null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (previewDates.length === 0) {
      setMessage("対象日付がありません。日付範囲と曜日を確認してください。");
      return;
    }
    const requirements: HeadcountRequirement[] = previewDates.map((date) => ({
      id: existingSlotId(date, startTime, endTime) ?? crypto.randomUUID(),
      planId,
      date,
      startTime: `${startTime}:00`,
      endTime: `${endTime}:00`,
      requiredCount,
    }));
    dispatch({ type: "BULK_UPSERT_HEADCOUNT", requirements });
    setMessage(`${previewDates.length}日分の必要人数を設定しました。`);
  }

  function handleUpdateCount(id: string, count: number) {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    dispatch({ type: "UPSERT_HEADCOUNT", requirement: { ...target, requiredCount: count } });
  }

  function handleUpdateTime(id: string, start: string, end: string) {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    dispatch({ type: "UPSERT_HEADCOUNT", requirement: { ...target, startTime: `${start}:00`, endTime: `${end}:00` } });
  }

  function handleAddSlot(dateKey: string, slotStart: string, slotEnd: string, count: number) {
    dispatch({
      type: "UPSERT_HEADCOUNT",
      requirement: {
        id: existingSlotId(dateKey, slotStart, slotEnd) ?? crypto.randomUUID(),
        planId,
        date: dateKey,
        startTime: `${slotStart}:00`,
        endTime: `${slotEnd}:00`,
        requiredCount: count,
      },
    });
  }

  function handleDelete(id: string) {
    dispatch({ type: "DELETE_HEADCOUNT", id });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            開始日
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            終了日
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            開始時刻
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            終了時刻
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            必要人数
            <Input type="number" min={0} value={requiredCount} onChange={(e) => setRequiredCount(Number(e.target.value))} className="w-20" required />
          </label>
        </div>

        <div>
          <p className="mb-1 text-sm text-zinc-500">対象曜日（絞り込み）</p>
          <div className="flex gap-2">
            {WEEKDAY_LABELS_JA.map((label, day) => (
              <label
                key={day}
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border text-sm ${
                  weekdays.includes(day) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-400"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={weekdays.includes(day)} onChange={() => toggleWeekday(day)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <p className="text-sm text-zinc-500">
          {previewDates.length > 0
            ? `${previewDates.length}日が対象になります（${previewDates[0]} 〜 ${previewDates[previewDates.length - 1]}）`
            : "日付範囲を選択してください"}
        </p>

        <div className="flex items-center gap-3">
          <Button type="submit">一括設定</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => dispatch({ type: "UNDO" })}
            disabled={!canUndo}
            title="直前の変更を元に戻します"
          >
            元に戻す
          </Button>
          {message && <span className="text-sm text-zinc-600">{message}</span>}
        </div>
      </form>

      <div>
        <h3 className="mb-2 text-base font-semibold text-zinc-700">設定済みの必要人数（{rows.length}件）</h3>
        <p className="mb-2 text-sm text-zinc-500">日付の「＋」から、その日だけの時間帯・人数を直接追加することもできます。</p>
        <HeadcountCalendar
          year={year}
          month={month}
          rows={rows}
          editable
          onDelete={handleDelete}
          onUpdateCount={handleUpdateCount}
          onUpdateTime={handleUpdateTime}
          onAddSlot={handleAddSlot}
        />
      </div>
    </div>
  );
}

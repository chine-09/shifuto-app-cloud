import { useRef, useState } from "react";
import { daysInMonth, toDateKey, weekdayOf, WEEKDAY_LABELS_JA, type HeadcountRequirement } from "@shifuto/shared-core";
import { useClickOutside } from "../../hooks/useClickOutside";

type EditingField = "count" | "time";

export function HeadcountCalendar({
  year,
  month,
  rows,
  editable = false,
  onDelete,
  onUpdateCount,
  onUpdateTime,
  onAddSlot,
}: {
  year: number;
  month: number;
  rows: HeadcountRequirement[];
  editable?: boolean;
  onDelete?: (id: string) => void;
  onUpdateCount?: (id: string, count: number) => void;
  onUpdateTime?: (id: string, startTime: string, endTime: string) => void;
  onAddSlot?: (dateKey: string, startTime: string, endTime: string, count: number) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");

  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("17:00");
  const [newCount, setNewCount] = useState("1");
  const addFormRef = useRef<HTMLDivElement>(null);
  useClickOutside(addFormRef, addingDate !== null, () => setAddingDate(null));

  const canEditCount = editable && Boolean(onUpdateCount);
  const canEditTime = editable && Boolean(onUpdateTime);
  const canAddSlot = editable && Boolean(onAddSlot);

  function startAdd(dateKey: string) {
    if (!canAddSlot) return;
    setAddingDate(dateKey);
    setNewStart("09:00");
    setNewEnd("17:00");
    setNewCount("1");
  }

  function commitAdd(dateKey: string) {
    setAddingDate(null);
    if (!onAddSlot) return;
    const count = Number(newCount);
    if (!newStart || !newEnd || newStart >= newEnd) return;
    if (Number.isNaN(count) || count < 0) return;
    onAddSlot(dateKey, newStart, newEnd, count);
  }

  function startEditCount(slot: HeadcountRequirement) {
    if (!canEditCount) return;
    setEditingId(slot.id);
    setEditingField("count");
    setDraftValue(String(slot.requiredCount));
  }

  function commitCount(slot: HeadcountRequirement) {
    setEditingId(null);
    setEditingField(null);
    if (!onUpdateCount) return;
    const next = Number(draftValue);
    if (Number.isNaN(next) || next < 0 || next === slot.requiredCount) return;
    onUpdateCount(slot.id, next);
  }

  function startEditTime(slot: HeadcountRequirement) {
    if (!canEditTime) return;
    setEditingId(slot.id);
    setEditingField("time");
    setDraftStart(slot.startTime.slice(0, 5));
    setDraftEnd(slot.endTime.slice(0, 5));
  }

  function commitTime(slot: HeadcountRequirement, start = draftStart, end = draftEnd) {
    setEditingId(null);
    setEditingField(null);
    if (!onUpdateTime) return;
    if (!start || !end || start >= end) return;
    if (start === slot.startTime.slice(0, 5) && end === slot.endTime.slice(0, 5)) return;
    onUpdateTime(slot.id, start, end);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingField(null);
  }

  const dates = daysInMonth(year, month);
  const leadingBlanks = weekdayOf(dates[0]);
  const trailingBlanks = 6 - weekdayOf(dates[dates.length - 1]);

  const rowsByDate = new Map<string, HeadcountRequirement[]>();
  for (const row of rows) {
    const list = rowsByDate.get(row.date) ?? [];
    list.push(row);
    rowsByDate.set(row.date, list);
  }
  for (const list of rowsByDate.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...dates,
    ...Array.from({ length: trailingBlanks }, () => null),
  ];

  return (
    <div className="rounded-md border border-zinc-200">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
        {WEEKDAY_LABELS_JA.map((label, i) => (
          <div
            key={label}
            className={`border-r border-zinc-200 px-2 py-1 text-center last:border-r-0 ${
              i === 0 ? "text-pink-600" : i === 6 ? "text-blue-600" : ""
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) {
            return <div key={`blank-${i}`} className="min-h-[7rem] border-b border-r border-zinc-100 bg-zinc-50/50 last:border-r-0" />;
          }
          const dateKey = toDateKey(date);
          const wd = weekdayOf(date);
          const slots = rowsByDate.get(dateKey) ?? [];
          return (
            <div key={dateKey} className="relative min-h-[7rem] border-b border-r border-zinc-100 p-1 last:border-r-0">
              <div className={`text-sm font-medium ${wd === 0 ? "text-pink-600" : wd === 6 ? "text-blue-600" : "text-zinc-700"}`}>
                {date.getDate()}
              </div>
              {canAddSlot && addingDate !== dateKey && (
                <button
                  type="button"
                  onClick={() => startAdd(dateKey)}
                  aria-label={`${dateKey}に時間帯を追加`}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-blue-600"
                >
                  +
                </button>
              )}
              <div className="mt-0.5 flex flex-col gap-0.5">
                {slots.map((slot) => (
                  <div key={slot.id} className="flex items-start justify-between gap-1 rounded bg-zinc-100 px-1 py-0.5 text-xs leading-tight text-zinc-600">
                    <span>
                      {editingId === slot.id && editingField === "time" ? (
                        <span className="flex items-center gap-0.5">
                          <input
                            type="time"
                            autoFocus
                            value={draftStart}
                            // A native time input only fires onChange once both
                            // the hour and minute are set to a complete value —
                            // so this fires exactly when the user finishes
                            // picking the minute, and we commit right away
                            // instead of waiting for blur (which happened
                            // silently and looked like nothing had responded).
                            onChange={(e) => {
                              setDraftStart(e.target.value);
                              if (e.target.value) commitTime(slot, e.target.value, draftEnd);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitTime(slot);
                              }
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="w-16 rounded border border-blue-400 px-0.5 text-xs"
                          />
                          <span>-</span>
                          <input
                            type="time"
                            value={draftEnd}
                            onChange={(e) => {
                              setDraftEnd(e.target.value);
                              if (e.target.value) commitTime(slot, draftStart, e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitTime(slot);
                              }
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="w-16 rounded border border-blue-400 px-0.5 text-xs"
                          />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditTime(slot)}
                          disabled={!canEditTime}
                          className={canEditTime ? "underline decoration-dotted hover:text-blue-600" : ""}
                        >
                          {slot.startTime.slice(0, 5)}-{slot.endTime.slice(0, 5)}
                        </button>
                      )}
                      <br />
                      {editingId === slot.id && editingField === "count" ? (
                        <input
                          type="number"
                          min={0}
                          autoFocus
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onBlur={() => commitCount(slot)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitCount(slot);
                            }
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="w-10 rounded border border-blue-400 px-0.5 text-xs"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditCount(slot)}
                          disabled={!canEditCount}
                          className={canEditCount ? "underline decoration-dotted hover:text-blue-600" : ""}
                        >
                          {slot.requiredCount}人
                        </button>
                      )}
                    </span>
                    {editable && onDelete && (
                      <button type="button" onClick={() => onDelete(slot.id)} className="shrink-0 text-zinc-400 hover:text-red-600" aria-label="削除">
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {canAddSlot && addingDate === dateKey && (
                  <div ref={addFormRef} className="flex flex-col gap-0.5 rounded border border-blue-400 bg-blue-50 p-1 text-xs">
                    <div className="flex items-center gap-0.5">
                      <input
                        type="time"
                        autoFocus
                        value={newStart}
                        onChange={(e) => {
                          setNewStart(e.target.value);
                          // Closes the browser's native hour/minute dropdown as soon as a
                          // complete time is picked, without closing this add-slot form
                          // (the 人数 field still needs to be filled in).
                          if (e.target.value) e.target.blur();
                        }}
                        className="w-16 rounded border border-zinc-300 px-0.5 text-xs"
                      />
                      <span>-</span>
                      <input
                        type="time"
                        value={newEnd}
                        onChange={(e) => {
                          setNewEnd(e.target.value);
                          if (e.target.value) e.target.blur();
                        }}
                        className="w-16 rounded border border-zinc-300 px-0.5 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} value={newCount} onChange={(e) => setNewCount(e.target.value)} className="w-10 rounded border border-zinc-300 px-0.5 text-xs" />
                      <span>人</span>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => setAddingDate(null)} className="text-zinc-500 hover:text-zinc-700">
                        取消
                      </button>
                      <button type="button" onClick={() => commitAdd(dateKey)} className="font-medium text-blue-600 hover:text-blue-800">
                        追加
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

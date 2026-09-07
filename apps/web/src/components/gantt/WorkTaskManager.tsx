import { useState } from "react";
import { asWorkTaskId, type WorkTask, type WorkTaskId } from "@shifuto/shared-core";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useAppDispatch } from "../../state/AppStateContext";

const DEFAULT_COLORS = ["#4ade80", "#facc15", "#38bdf8", "#f472b6", "#fb923c", "#a78bfa"];
const BREAK_COLOR = "#e4e4e7"; // zinc-200, matches DayGanttRow's break color

export type QuickAddSelection = { taskId: WorkTaskId | null } | null;

/**
 * Store-wide master data for the "作業a/b/c…" categories used by the
 * detailed Gantt view. Each chip is also clickable to arm "quick add" mode
 * (see GanttDetailPage/DayGanttRow): once armed, clicking empty timeline
 * space places a 1-hour segment of that task directly, without opening the
 * edit modal.
 */
export function WorkTaskManager({
  workTasks,
  quickAddSelection = null,
  onSelectQuickAdd,
}: {
  workTasks: WorkTask[];
  quickAddSelection?: QuickAddSelection;
  onSelectQuickAdd?: (selection: QuickAddSelection) => void;
}) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");

  function toggleQuickAdd(selection: QuickAddSelection) {
    if (!onSelectQuickAdd) return;
    const isSameSelection =
      quickAddSelection !== null && selection !== null && quickAddSelection.taskId === selection.taskId;
    onSelectQuickAdd(isSameSelection ? null : selection);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const color = DEFAULT_COLORS[workTasks.length % DEFAULT_COLORS.length];
    dispatch({ type: "UPSERT_WORK_TASK", workTask: { id: asWorkTaskId(crypto.randomUUID()), name: name.trim(), color } });
    setName("");
  }

  function handleColorChange(task: WorkTask, color: string) {
    dispatch({ type: "UPSERT_WORK_TASK", workTask: { ...task, color } });
  }

  function handleDelete(id: WorkTask["id"]) {
    if (!confirm("この作業種別を削除します。割り当て済みのこの作業は「休憩」として扱われます。よろしいですか？")) return;
    dispatch({ type: "DELETE_WORK_TASK", id });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {workTasks.map((task) => {
          const isSelected = quickAddSelection?.taskId === task.id;
          return (
            <span
              key={task.id}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${
                isSelected ? "border-brand bg-brand-light ring-1 ring-brand" : "border-zinc-200"
              }`}
            >
              <input
                type="color"
                value={task.color}
                onChange={(e) => handleColorChange(task, e.target.value)}
                className="h-4 w-4 cursor-pointer rounded-sm border-0"
                title="表示色を変更"
              />
              <button
                type="button"
                onClick={() => toggleQuickAdd({ taskId: task.id })}
                className="cursor-pointer"
                title="クリックして選択し、タイムラインの空き時間をクリックすると1時間分配置されます"
              >
                {task.name}
              </button>
              <button type="button" onClick={() => handleDelete(task.id)} className="text-zinc-400 hover:text-red-600" title="削除">
                ×
              </button>
            </span>
          );
        })}
        {onSelectQuickAdd && (
          <span
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${
              quickAddSelection && quickAddSelection.taskId === null ? "border-brand bg-brand-light ring-1 ring-brand" : "border-zinc-200"
            }`}
          >
            <span className="h-4 w-4 rounded-sm" style={{ backgroundColor: BREAK_COLOR }} />
            <button type="button" onClick={() => toggleQuickAdd({ taskId: null })} className="cursor-pointer" title="クリックして選択">
              休憩
            </button>
          </span>
        )}
        {workTasks.length === 0 && <span className="text-sm text-zinc-400">まだ作業種別がありません。</span>}
      </div>
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: レジ、品出し"
          className="w-48"
        />
        <Button type="submit" variant="secondary">
          作業種別を追加
        </Button>
      </form>
      {onSelectQuickAdd && (
        <p className="text-sm text-zinc-400">
          ※マスタを選択後、タイムラインの空き時間をクリックすると1時間分直接配置されます。Escキーで解除。
        </p>
      )}
    </div>
  );
}

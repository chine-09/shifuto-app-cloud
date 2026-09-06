import { useState } from "react";
import { asWorkTaskId, type WorkTask } from "@shifuto/shared-core";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useAppDispatch } from "../../state/AppStateContext";

const DEFAULT_COLORS = ["#4ade80", "#facc15", "#38bdf8", "#f472b6", "#fb923c", "#a78bfa"];

/** Store-wide master data for the "作業a/b/c…" categories used by the detailed Gantt view. */
export function WorkTaskManager({ workTasks }: { workTasks: WorkTask[] }) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");

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
        {workTasks.map((task) => (
          <span key={task.id} className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2 py-1 text-sm">
            <input
              type="color"
              value={task.color}
              onChange={(e) => handleColorChange(task, e.target.value)}
              className="h-4 w-4 cursor-pointer rounded-sm border-0"
              title="表示色を変更"
            />
            {task.name}
            <button type="button" onClick={() => handleDelete(task.id)} className="text-zinc-400 hover:text-red-600" title="削除">
              ×
            </button>
          </span>
        ))}
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
    </div>
  );
}

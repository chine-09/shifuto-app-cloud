import { useState } from "react";
import type { WorkRule } from "@shifuto/shared-core";
import { Input } from "../ui/Input";
import { useAppDispatch } from "../../state/AppStateContext";

export function WorkRuleForm({ workRule }: { workRule: WorkRule | null }) {
  const dispatch = useAppDispatch();
  const [maxConsecutive, setMaxConsecutive] = useState(workRule?.maxConsecutiveWorkDays?.toString() ?? "");
  const [maxWeekly, setMaxWeekly] = useState(workRule?.maxWeeklyHours?.toString() ?? "");

  function commit(nextConsecutive: string, nextWeekly: string) {
    const consecutiveNum = nextConsecutive === "" ? null : Number(nextConsecutive);
    const weeklyNum = nextWeekly === "" ? null : Number(nextWeekly);
    if (consecutiveNum != null && Number.isNaN(consecutiveNum)) return;
    if (weeklyNum != null && Number.isNaN(weeklyNum)) return;
    dispatch({
      type: "UPDATE_WORK_RULE",
      workRule: { maxConsecutiveWorkDays: consecutiveNum, maxWeeklyHours: weeklyNum },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-6">
        <label className="flex flex-col gap-1 text-sm text-zinc-500">
          最大連続勤務日数
          <Input
            type="number"
            min={1}
            step={1}
            value={maxConsecutive}
            onChange={(e) => {
              setMaxConsecutive(e.target.value);
              commit(e.target.value, maxWeekly);
            }}
            placeholder="未設定"
            className="w-32"
          />
          <span className="max-w-64 text-sm text-zinc-400">この日数を超えて連続で勤務が割り当てられていると違反として検出します。</span>
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-500">
          週間最大労働時間
          <Input
            type="number"
            min={1}
            step={0.5}
            value={maxWeekly}
            onChange={(e) => {
              setMaxWeekly(e.target.value);
              commit(maxConsecutive, e.target.value);
            }}
            placeholder="未設定"
            className="w-32"
          />
          <span className="max-w-64 text-sm text-zinc-400">
            日曜始まりの1週間で、この時間を超えて勤務時間が割り当てられていると違反として検出します。
          </span>
        </label>
      </div>
      <span className="text-sm text-zinc-400">入力すると自動的に反映されます（保存ボタンは不要です）。</span>
    </div>
  );
}

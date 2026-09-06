import { Link } from "react-router-dom";
import { WorkRuleForm } from "../components/settings/WorkRuleForm";
import { Input } from "../components/ui/Input";
import { useAppDispatch, useAppState } from "../state/AppStateContext";

export function SettingsPage() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h1 className="text-2xl font-bold text-zinc-900">設定</h1>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-3">
        <h2 className="mb-2 text-base font-semibold text-zinc-700">店舗名</h2>
        <label className="flex flex-col gap-1 text-sm text-zinc-500">
          店舗名（Excel出力の見出しに使われます）
          <Input
            type="text"
            value={state.meta.storeName}
            onChange={(e) => dispatch({ type: "UPDATE_STORE_NAME", name: e.target.value })}
            className="w-64"
          />
          <span className="text-sm text-zinc-400">入力すると自動的に反映されます（保存ボタンは不要です）。</span>
        </label>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-3">
        <h2 className="mb-1 text-base font-semibold text-zinc-700">勤務ルール（連続勤務日数・週間労働時間の上限）</h2>
        <p className="mb-2 text-sm text-zinc-500">
          ここで設定した上限を超えるシフトは、各シフト計画の「シフト表」画面で違反として警告されます。
        </p>
        <WorkRuleForm workRule={state.workRule} />
      </section>

      <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-sm text-zinc-600">設定はここまでです。</p>
        <Link
          to="/"
          className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-base font-medium text-white transition-colors hover:bg-blue-700"
        >
          TOPでシフト計画を開く
        </Link>
      </div>
    </div>
  );
}

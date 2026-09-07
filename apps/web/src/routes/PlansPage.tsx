import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { planIdFor, type MonthlyPlan } from "@shifuto/shared-core";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAppDispatch, useAppState } from "../state/AppStateContext";

export function PlansPage() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    const plan: MonthlyPlan = { id: planIdFor(year, month), year, month };
    dispatch({ type: "UPSERT_PLAN", plan });
    navigate(`/plans/${plan.id}/leaves`);
  }

  const sortedPlans = [...state.plans].sort((a, b) => b.id.localeCompare(a.id));
  const employeeCount = state.employees.length;
  const hasWorkRule = state.workRule != null;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-2xl font-bold text-zinc-900">シフト作成</h1>
        {state.meta.storeName && <p className="mt-0.5 text-base font-medium text-zinc-600">{state.meta.storeName}</p>}
        <p className="mt-1 text-base text-zinc-500">月を選んでシフト表の作成・編集を行います。</p>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-base font-semibold text-zinc-700">はじめに</h2>
        <ol className="flex flex-col gap-2">
          <OnboardingStep
            done={employeeCount > 0}
            label="① 従業員を登録する"
            status={employeeCount > 0 ? `${employeeCount}名登録済み` : "未登録"}
            to="/employees"
          />
          <OnboardingStep
            done={hasWorkRule}
            label="② 勤務ルールを設定する（連続勤務日数・週間労働時間の上限、任意）"
            status={hasWorkRule ? "設定済み" : "未設定"}
            to="/settings"
          />
          <li className="flex items-start gap-2 text-sm text-zinc-500">
            <span className="mt-0.5 text-zinc-300">○</span>
            <span>③ 下のフォームで月を開き、希望休・必要人数を設定してからシフト表を作成する</span>
          </li>
        </ol>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-base font-semibold text-zinc-700">月を開く / 新規作成</h2>
        {employeeCount === 0 && (
          <p className="mb-3 text-sm text-amber-600">
            先に「従業員」画面で従業員を登録すると、この後の希望休・シフト作成がスムーズです。
          </p>
        )}
        <form onSubmit={handleOpen} className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            年
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" required />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            月
            <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-20" required />
          </label>
          <Button type="submit">開く</Button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-700">シフト計画一覧</h2>
        {sortedPlans.length === 0 ? (
          <p className="text-base text-zinc-500">まだシフト計画がありません。</p>
        ) : (
          <ul className="divide-y divide-zinc-200 card">
            {sortedPlans.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/plans/${plan.id}/shifts`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-base hover:bg-zinc-50"
                >
                  {plan.year}年{plan.month}月
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OnboardingStep({
  done,
  label,
  status,
  to,
}: {
  done: boolean;
  label: string;
  status: string;
  to: string;
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={done ? "text-green-600" : "text-zinc-300"} aria-hidden>
        {done ? "✓" : "○"}
      </span>
      <Link to={to} className="text-blue-600 hover:underline">
        {label}
      </Link>
      <span className={done ? "text-green-600" : "text-zinc-400"}>（{status}）</span>
    </li>
  );
}

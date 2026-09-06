import { Link, Navigate, Outlet, useParams } from "react-router-dom";
import { asPlanId } from "@shifuto/shared-core";
import { useAppState } from "../../state/AppStateContext";
import { planById, violationsForPlan } from "../../state/selectors";

export function PlanLayout() {
  const { planId: rawPlanId } = useParams<{ planId: string }>();
  const state = useAppState();
  const planId = asPlanId(rawPlanId ?? "");
  const plan = planById(state, planId);

  if (!plan) return <Navigate to="/" replace />;

  const violations = violationsForPlan(state, planId);
  const tabs = [
    { href: `/plans/${planId}/leaves`, label: "① 希望休入力" },
    { href: `/plans/${planId}/headcount`, label: "② 必要人数設定" },
    { href: `/plans/${planId}/shifts`, label: "③ シフト表", hasWarning: violations.length > 0 },
    { href: `/plans/${planId}/shifts-detail`, label: "④ 分刻み編集（任意）" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          {plan.year}年{plan.month}月のシフト計画
        </h1>
        <nav className="mt-3 flex gap-1 border-b border-zinc-200">
          {tabs.map((tab) => (
            <Link key={tab.href} to={tab.href} className="rounded-t-md px-3 py-2 text-base text-zinc-600 hover:bg-white hover:text-zinc-900">
              {tab.label}
              {tab.hasWarning && (
                <span className="ml-1 text-sm font-bold text-red-600" title="制約違反があります">
                  ！
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet context={{ planId, plan }} />
    </div>
  );
}

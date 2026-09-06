import { Link } from "react-router-dom";
import { daysInMonth } from "@shifuto/shared-core";
import { LeavesForm } from "../../components/leaves/LeavesForm";
import { useAppState } from "../../state/AppStateContext";
import { activeEmployees, leavesForPlan } from "../../state/selectors";
import { usePlanContext } from "./usePlanContext";

export function LeavesPage() {
  const { planId, plan } = usePlanContext();
  const state = useAppState();
  const employees = activeEmployees(state);
  const leaveKeys = leavesForPlan(state, planId).map((l) => `${l.employeeId}_${l.date}`);

  if (employees.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-base text-zinc-600">
        先に<Link to="/employees" className="text-blue-600 hover:underline">「従業員」画面</Link>で従業員を登録してください。
      </section>
    );
  }

  return (
    <LeavesForm
      planId={planId}
      employees={employees}
      dates={daysInMonth(plan.year, plan.month)}
      initialLeaveKeys={leaveKeys}
    />
  );
}

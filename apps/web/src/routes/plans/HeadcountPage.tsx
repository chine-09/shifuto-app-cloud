import { Link } from "react-router-dom";
import { HeadcountBulkForm } from "../../components/headcount/HeadcountBulkForm";
import { useAppState } from "../../state/AppStateContext";
import { activeEmployees } from "../../state/selectors";
import { usePlanContext } from "./usePlanContext";

export function HeadcountPage() {
  const { planId, plan } = usePlanContext();
  const employees = activeEmployees(useAppState());

  if (employees.length === 0) {
    return (
      <section className="card p-4 text-base text-zinc-600">
        先に<Link to="/employees" className="text-blue-600 hover:underline">「従業員」画面</Link>で従業員を登録してください。
      </section>
    );
  }

  return <HeadcountBulkForm planId={planId} year={plan.year} month={plan.month} />;
}

import { useOutletContext } from "react-router-dom";
import type { MonthlyPlan, PlanId } from "@shifuto/shared-core";

export function usePlanContext() {
  return useOutletContext<{ planId: PlanId; plan: MonthlyPlan }>();
}

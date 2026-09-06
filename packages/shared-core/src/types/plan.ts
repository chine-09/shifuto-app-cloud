import type { PlanId } from "./ids";

export type MonthlyPlan = {
  id: PlanId;
  year: number;
  month: number; // 1-12
};

/** Deterministic plan id from year/month, so creating a plan is idempotent. */
export function planIdFor(year: number, month: number): PlanId {
  return `${year}-${String(month).padStart(2, "0")}` as PlanId;
}

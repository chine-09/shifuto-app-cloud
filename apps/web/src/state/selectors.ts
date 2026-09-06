import { checkViolations, type PlanId, type Violation } from "@shifuto/shared-core";
import type { AppState } from "./types";

export function employeesById(state: AppState) {
  return new Map(state.employees.map((e) => [e.id, e]));
}

export function planById(state: AppState, planId: PlanId) {
  return state.plans.find((p) => p.id === planId) ?? null;
}

export function shiftsForPlan(state: AppState, planId: PlanId) {
  return state.assignedShifts.filter((s) => s.planId === planId);
}

export function leavesForPlan(state: AppState, planId: PlanId) {
  return state.requestedLeaves.filter((l) => l.planId === planId);
}

export function headcountForPlan(state: AppState, planId: PlanId) {
  return state.headcountRequirements.filter((r) => r.planId === planId);
}

export function taskSegmentsForDay(state: AppState, planId: PlanId, date: string) {
  return state.taskSegments.filter((s) => s.planId === planId && s.date === date);
}

export function requiredCountByDate(headcountRequirements: { date: string; requiredCount: number }[]) {
  const map = new Map<string, number>();
  for (const row of headcountRequirements) {
    map.set(row.date, (map.get(row.date) ?? 0) + row.requiredCount);
  }
  return map;
}

export function violationsForPlan(state: AppState, planId: PlanId): Violation[] {
  return checkViolations({
    assignedShifts: shiftsForPlan(state, planId),
    requestedLeaves: leavesForPlan(state, planId),
    headcountRequirements: headcountForPlan(state, planId),
    workRule: state.workRule,
  });
}

export function activeEmployees(state: AppState) {
  return state.employees.filter((e) => e.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

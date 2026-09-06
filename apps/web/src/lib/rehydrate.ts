import { computeShiftHours, type AssignedShift, type AutoAssignShiftsResponse, type PlanId } from "@shifuto/shared-core";

/**
 * Turns Lambda's ID-only result back into full AssignedShift rows for this
 * plan. Real names are never part of this step — they are resolved later,
 * at render time, from local state (see lib/violationMessages.ts) — this
 * function only re-attaches the plan id and derives `hours` locally.
 */
export function rehydrateAssignedShifts(
  response: AutoAssignShiftsResponse["assignedShifts"],
  planId: PlanId,
): AssignedShift[] {
  return response.map((s) => ({
    ...s,
    planId,
    hours: computeShiftHours(s.shiftType, s.startTime, s.endTime),
  }));
}

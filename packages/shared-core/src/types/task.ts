import type { EmployeeId, PlanId } from "./ids";

export type WorkTaskId = string & { readonly __brand: "WorkTaskId" };

export function asWorkTaskId(id: string): WorkTaskId {
  return id as WorkTaskId;
}

/** Store-wide master data for the kinds of work that can appear inside a shift (e.g. "作業a", "レジ"). */
export type WorkTask = {
  id: WorkTaskId;
  name: string;
  color: string; // any CSS color, e.g. "#4ade80" — display only
};

/**
 * A fine-grained (15-minute-resolution) slice of one employee's day, used by
 * the Gantt-style detailed shift view. `taskId: null` represents a break —
 * every other segment is one unit of assigned work. Segments are additive
 * detail on top of the existing coarse `AssignedShift` (start/end time,
 * "work"/"leave"/"off"); the simple shift table keeps working purely off
 * AssignedShift and never needs to know segments exist.
 */
export type TaskSegment = {
  id: string;
  planId: PlanId;
  employeeId: EmployeeId;
  date: string; // YYYY-MM-DD
  taskId: WorkTaskId | null; // null = 休憩(break)
  startTime: string; // "HH:mm", 15-minute increments
  endTime: string; // "HH:mm", 15-minute increments
};

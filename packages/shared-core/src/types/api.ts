import type { AnonymizedEmployee } from "./anonymized";
import type { EmployeeId, PlanId } from "./ids";
import type { HeadcountRequirement, ShiftType } from "./shift";
import type { WorkRule } from "./workRule";
import type { Violation } from "../validation/checkViolations";

/**
 * The only shape the frontend may send to Lambda. Every field is
 * PII-free: employees carry only their id, never a name.
 */
export type AutoAssignShiftsRequest = {
  planId: PlanId;
  employees: AnonymizedEmployee[];
  requestedLeaves: { employeeId: EmployeeId; date: string }[];
  headcountRequirements: HeadcountRequirement[];
  workRule: WorkRule | null;
  dateRange: { start: string; end: string };
};

export type AutoAssignShiftsResponse = {
  assignedShifts: {
    employeeId: EmployeeId;
    date: string;
    shiftType: ShiftType;
    startTime: string | null;
    endTime: string | null;
  }[];
  violations: Violation[];
};

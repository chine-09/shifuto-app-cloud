import type { EmployeeId, PlanId } from "./ids";

export type ShiftType = "work" | "leave" | "off";

export type AssignedShift = {
  employeeId: EmployeeId;
  planId: PlanId;
  date: string; // YYYY-MM-DD
  shiftType: ShiftType;
  startTime: string | null;
  endTime: string | null;
  hours: number;
};

export type RequestedLeave = {
  employeeId: EmployeeId;
  planId: PlanId;
  date: string; // YYYY-MM-DD
};

export type HeadcountRequirement = {
  id: string;
  planId: PlanId;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  requiredCount: number;
};

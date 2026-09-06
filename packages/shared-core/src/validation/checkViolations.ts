import { fromDateKey, startOfWeekKey } from "../date";
import type { EmployeeId } from "../types/ids";
import type {
  AssignedShift,
  HeadcountRequirement,
  RequestedLeave,
} from "../types/shift";
import type { WorkRule } from "../types/workRule";

export type ViolationType =
  | "unmet_leave_request"
  | "max_consecutive_days"
  | "max_weekly_hours"
  | "understaffed_slot";

/**
 * Contains no PII: only ids, enums, and dates. Human-readable messages
 * (e.g. "〇〇さんは...") are built from this by the frontend, after
 * rehydrating employeeId back to a real name — see apps/web/src/lib/rehydrate.ts.
 */
export type Violation = {
  type: ViolationType;
  employeeId?: EmployeeId;
  /** Single date this violation is anchored to (used for cell highlighting). */
  date?: string;
  /** Full set of dates involved (e.g. a consecutive-work-day run, or the days in a week). */
  dates?: string[];
  /** For understaffed_slot: the headcount requirement id. */
  slotId?: string;
};

export type CheckViolationsInput = {
  assignedShifts: AssignedShift[];
  requestedLeaves: RequestedLeave[];
  headcountRequirements: HeadcountRequirement[];
  workRule: WorkRule | null;
};

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Pure function: no I/O, no PII in or out. */
export function checkViolations(input: CheckViolationsInput): Violation[] {
  return [
    ...checkUnmetLeaveRequests(input),
    ...checkMaxConsecutiveDays(input),
    ...checkMaxWeeklyHours(input),
    ...checkUnderstaffedSlots(input),
  ];
}

function checkUnmetLeaveRequests({
  assignedShifts,
  requestedLeaves,
}: CheckViolationsInput): Violation[] {
  const workShiftKey = new Set(
    assignedShifts
      .filter((s) => s.shiftType === "work")
      .map((s) => `${s.employeeId}_${s.date}`),
  );

  const violations: Violation[] = [];
  for (const leave of requestedLeaves) {
    const key = `${leave.employeeId}_${leave.date}`;
    if (workShiftKey.has(key)) {
      violations.push({
        type: "unmet_leave_request",
        employeeId: leave.employeeId,
        date: leave.date,
        dates: [leave.date],
      });
    }
  }
  return violations;
}

function checkMaxConsecutiveDays({
  assignedShifts,
  workRule,
}: CheckViolationsInput): Violation[] {
  const maxConsecutive = workRule?.maxConsecutiveWorkDays ?? null;
  if (maxConsecutive == null) return [];

  const violations: Violation[] = [];
  const workDatesByEmployee = new Map<EmployeeId, string[]>();
  for (const shift of assignedShifts) {
    if (shift.shiftType !== "work") continue;
    const list = workDatesByEmployee.get(shift.employeeId) ?? [];
    list.push(shift.date);
    workDatesByEmployee.set(shift.employeeId, list);
  }

  for (const [employeeId, dates] of workDatesByEmployee) {
    const sorted = [...dates].sort();
    let runStart = 0;
    for (let i = 1; i <= sorted.length; i++) {
      const isConsecutive =
        i < sorted.length &&
        fromDateKey(sorted[i]).getTime() - fromDateKey(sorted[i - 1]).getTime() ===
          24 * 60 * 60 * 1000;
      if (!isConsecutive) {
        const runLength = i - runStart;
        if (runLength > maxConsecutive) {
          const runDates = sorted.slice(runStart, i);
          violations.push({
            type: "max_consecutive_days",
            employeeId,
            date: runDates[0],
            dates: runDates,
          });
        }
        runStart = i;
      }
    }
  }
  return violations;
}

function checkMaxWeeklyHours({
  assignedShifts,
  workRule,
}: CheckViolationsInput): Violation[] {
  const maxWeeklyHours = workRule?.maxWeeklyHours ?? null;
  if (maxWeeklyHours == null) return [];

  const violations: Violation[] = [];
  const hoursByEmployeeWeek = new Map<string, { hours: number; dates: string[] }>();
  for (const shift of assignedShifts) {
    if (shift.shiftType !== "work") continue;
    const weekKey = startOfWeekKey(shift.date);
    const key = `${shift.employeeId}::${weekKey}`;
    const entry = hoursByEmployeeWeek.get(key) ?? { hours: 0, dates: [] };
    entry.hours += shift.hours;
    entry.dates.push(shift.date);
    hoursByEmployeeWeek.set(key, entry);
  }

  for (const [key, entry] of hoursByEmployeeWeek) {
    if (entry.hours > maxWeeklyHours) {
      const [employeeId] = key.split("::");
      const sortedDates = [...entry.dates].sort();
      violations.push({
        type: "max_weekly_hours",
        employeeId: employeeId as EmployeeId,
        date: sortedDates[0],
        dates: sortedDates,
      });
    }
  }
  return violations;
}

function checkUnderstaffedSlots({
  assignedShifts,
  headcountRequirements,
}: CheckViolationsInput): Violation[] {
  const violations: Violation[] = [];

  for (const req of headcountRequirements) {
    const reqStart = toMinutes(req.startTime);
    const reqEnd = toMinutes(req.endTime);

    const assignedCount = assignedShifts.filter((shift) => {
      if (shift.shiftType !== "work") return false;
      if (shift.date !== req.date) return false;
      if (!shift.startTime || !shift.endTime) return false;
      return toMinutes(shift.startTime) <= reqStart && toMinutes(shift.endTime) >= reqEnd;
    }).length;

    if (assignedCount < req.requiredCount) {
      violations.push({
        type: "understaffed_slot",
        date: req.date,
        dates: [req.date],
        slotId: req.id,
      });
    }
  }
  return violations;
}

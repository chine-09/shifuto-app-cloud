import { checkViolations } from "../validation/checkViolations";
import { computeShiftHours } from "../hours";
import { fromDateKey, startOfWeekKey } from "../date";
import type { EmployeeId } from "../types/ids";
import type { AssignedShift } from "../types/shift";
import type { AutoAssignShiftsRequest, AutoAssignShiftsResponse } from "../types/api";

type DateWindow = { date: string; start: string; end: string; count: number };

// Each headcount requirement (e.g. an early shift and a late shift on the
// same day) is scheduled independently — merging same-day windows together
// would collapse a two-shift day into one giant window and assign every
// candidate a single shift spanning the full merged range.
function buildDateWindows(
  headcountRequirements: AutoAssignShiftsRequest["headcountRequirements"],
): DateWindow[] {
  return [...headcountRequirements]
    .map((req) => ({ date: req.date, start: req.startTime, end: req.endTime, count: req.requiredCount }))
    .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));
}

/**
 * Greedy full-month scheduler: for each date, fills the required headcount
 * from the least-scheduled-so-far eligible employees, skipping anyone whose
 * leave request, consecutive-day limit, or weekly-hours limit would be
 * violated. Produces a reasonable first draft ("80点のベース") for a human
 * to fine-tune in the UI afterward — not an optimal solver.
 *
 * Pure function: no PII in (AnonymizedEmployee only) or out.
 */
export function autoAssignShifts(request: AutoAssignShiftsRequest): AutoAssignShiftsResponse {
  const { planId, employees, requestedLeaves, headcountRequirements, workRule, dateRange } = request;

  const windows = buildDateWindows(headcountRequirements);

  const leavesByDate = new Map<string, Set<EmployeeId>>();
  for (const leave of requestedLeaves) {
    const set = leavesByDate.get(leave.date) ?? new Set<EmployeeId>();
    set.add(leave.employeeId);
    leavesByDate.set(leave.date, set);
  }

  const totalHoursByEmployee = new Map<EmployeeId, number>();
  const weeklyHoursByEmployeeWeek = new Map<string, number>();
  const lastWorkDateByEmployee = new Map<EmployeeId, string>();
  const consecutiveDaysByEmployee = new Map<EmployeeId, number>();
  const assignedDatesByEmployee = new Map<EmployeeId, Set<string>>();
  for (const emp of employees) totalHoursByEmployee.set(emp.id, 0);

  const assigned: AssignedShift[] = [];

  for (const window of windows) {
    const { date } = window;
    const hours = computeShiftHours("work", window.start, window.end);
    const onLeave = leavesByDate.get(date) ?? new Set<EmployeeId>();

    const candidates = employees
      // A candidate already assigned to another window the same day (e.g.
      // the early shift) can't also take the late shift on that same day.
      .filter((e) => !onLeave.has(e.id) && !assignedDatesByEmployee.get(e.id)?.has(date))
      .sort((a, b) => (totalHoursByEmployee.get(a.id) ?? 0) - (totalHoursByEmployee.get(b.id) ?? 0));

    let filled = 0;
    for (const candidate of candidates) {
      if (filled >= window.count) break;

      const lastWorkDate = lastWorkDateByEmployee.get(candidate.id);
      const isConsecutive =
        lastWorkDate != null &&
        fromDateKey(date).getTime() - fromDateKey(lastWorkDate).getTime() === 24 * 60 * 60 * 1000;
      const consecutiveSoFar = isConsecutive ? (consecutiveDaysByEmployee.get(candidate.id) ?? 1) : 0;
      if (workRule?.maxConsecutiveWorkDays != null && consecutiveSoFar + 1 > workRule.maxConsecutiveWorkDays) {
        continue;
      }

      const weekKey = `${candidate.id}::${startOfWeekKey(date)}`;
      const weeklyHoursSoFar = weeklyHoursByEmployeeWeek.get(weekKey) ?? 0;
      if (workRule?.maxWeeklyHours != null && weeklyHoursSoFar + hours > workRule.maxWeeklyHours) {
        continue;
      }

      assigned.push({
        employeeId: candidate.id,
        planId,
        date,
        shiftType: "work",
        startTime: window.start,
        endTime: window.end,
        hours,
      });

      totalHoursByEmployee.set(candidate.id, (totalHoursByEmployee.get(candidate.id) ?? 0) + hours);
      weeklyHoursByEmployeeWeek.set(weekKey, weeklyHoursSoFar + hours);
      consecutiveDaysByEmployee.set(candidate.id, consecutiveSoFar + 1);
      lastWorkDateByEmployee.set(candidate.id, date);
      const datesForEmployee = assignedDatesByEmployee.get(candidate.id) ?? new Set<string>();
      datesForEmployee.add(date);
      assignedDatesByEmployee.set(candidate.id, datesForEmployee);
      filled += 1;
    }
  }

  const violations = checkViolations({
    assignedShifts: assigned,
    requestedLeaves: requestedLeaves.map((l) => ({ ...l, planId })),
    headcountRequirements,
    workRule,
  }).filter((v) => v.date == null || (v.date >= dateRange.start && v.date <= dateRange.end));

  return {
    assignedShifts: assigned.map((s) => ({
      employeeId: s.employeeId,
      date: s.date,
      shiftType: s.shiftType,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
    violations,
  };
}

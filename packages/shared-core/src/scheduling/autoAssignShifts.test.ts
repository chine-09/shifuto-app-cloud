import { describe, expect, it } from "vitest";
import { autoAssignShifts } from "./autoAssignShifts";
import { asEmployeeId, asPlanId } from "../types/ids";
import type { AnonymizedEmployee } from "../types/anonymized";
import type { AutoAssignShiftsRequest } from "../types/api";

const planId = asPlanId("plan-1");

function anon(id: string): AnonymizedEmployee {
  return { __anonymized: true, id: asEmployeeId(id), employmentType: "part_time", isActive: true };
}

function baseRequest(overrides: Partial<AutoAssignShiftsRequest> = {}): AutoAssignShiftsRequest {
  return {
    planId,
    employees: [anon("e1"), anon("e2")],
    requestedLeaves: [],
    headcountRequirements: [],
    workRule: null,
    dateRange: { start: "2026-09-01", end: "2026-09-30" },
    ...overrides,
  };
}

describe("autoAssignShifts", () => {
  it("fills the required headcount from eligible employees", () => {
    const result = autoAssignShifts(
      baseRequest({
        headcountRequirements: [
          { id: "h1", planId, date: "2026-09-01", startTime: "09:00", endTime: "17:00", requiredCount: 1 },
        ],
      }),
    );
    expect(result.assignedShifts).toHaveLength(1);
    expect(result.assignedShifts[0].date).toBe("2026-09-01");
    expect(result.violations).toHaveLength(0);
  });

  it("never assigns an employee on a date they requested leave for", () => {
    const result = autoAssignShifts(
      baseRequest({
        requestedLeaves: [{ employeeId: asEmployeeId("e1"), date: "2026-09-01" }],
        headcountRequirements: [
          { id: "h1", planId, date: "2026-09-01", startTime: "09:00", endTime: "17:00", requiredCount: 1 },
        ],
      }),
    );
    expect(result.assignedShifts).toHaveLength(1);
    expect(result.assignedShifts[0].employeeId).toBe("e2");
  });

  it("reports an understaffed_slot violation when there are not enough eligible employees", () => {
    const result = autoAssignShifts(
      baseRequest({
        requestedLeaves: [
          { employeeId: asEmployeeId("e1"), date: "2026-09-01" },
          { employeeId: asEmployeeId("e2"), date: "2026-09-01" },
        ],
        headcountRequirements: [
          { id: "h1", planId, date: "2026-09-01", startTime: "09:00", endTime: "17:00", requiredCount: 1 },
        ],
      }),
    );
    expect(result.assignedShifts).toHaveLength(0);
    expect(result.violations.some((v) => v.type === "understaffed_slot")).toBe(true);
  });

  it("respects maxConsecutiveWorkDays by rotating in a less-scheduled employee", () => {
    const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];
    const result = autoAssignShifts(
      baseRequest({
        workRule: { maxConsecutiveWorkDays: 1, maxWeeklyHours: null },
        headcountRequirements: dates.map((date, i) => ({
          id: `h${i}`,
          planId,
          date,
          startTime: "09:00",
          endTime: "17:00",
          requiredCount: 1,
        })),
      }),
    );
    // e1 works day 1, would break the 1-day limit on day 2, so e2 takes day 2, then e1 is free again on day 3.
    const byDate = new Map(result.assignedShifts.map((s) => [s.date, s.employeeId]));
    expect(byDate.get("2026-09-01")).toBe("e1");
    expect(byDate.get("2026-09-02")).toBe("e2");
    expect(result.violations.filter((v) => v.type === "max_consecutive_days")).toHaveLength(0);
  });

  it("schedules same-day early/late shifts as separate windows instead of merging them", () => {
    // Regression test: same-day headcount requirements used to be merged into
    // one giant window (min start, max end), producing a single long shift
    // spanning both instead of two distinct shifts filled independently.
    const result = autoAssignShifts(
      baseRequest({
        employees: [anon("e1"), anon("e2"), anon("e3"), anon("e4")],
        headcountRequirements: [
          { id: "h1", planId, date: "2026-09-01", startTime: "08:30", endTime: "15:00", requiredCount: 2 },
          { id: "h2", planId, date: "2026-09-01", startTime: "14:30", endTime: "21:00", requiredCount: 2 },
        ],
      }),
    );
    expect(result.assignedShifts).toHaveLength(4);
    expect(result.assignedShifts.every((s) => s.startTime === "08:30" || s.startTime === "14:30")).toBe(true);
    expect(result.assignedShifts.some((s) => s.startTime === "08:30" && s.endTime === "15:00")).toBe(true);
    expect(result.assignedShifts.some((s) => s.startTime === "14:30" && s.endTime === "21:00")).toBe(true);
    // No employee double-booked into both the early and late shift the same day.
    const employeeIds = result.assignedShifts.map((s) => s.employeeId);
    expect(new Set(employeeIds).size).toBe(employeeIds.length);
  });

  it("never leaks anything beyond ids, enums, and dates in the response", () => {
    const result = autoAssignShifts(
      baseRequest({
        headcountRequirements: [
          { id: "h1", planId, date: "2026-09-01", startTime: "09:00", endTime: "17:00", requiredCount: 2 },
        ],
      }),
    );
    const json = JSON.stringify(result);
    expect(json).not.toContain("name");
    expect(json).not.toMatch(/[ぁ-んァ-ヶ一-龠]/); // no Japanese text (a real name would show up here)
  });
});

import { describe, expect, it } from "vitest";
import { checkViolations, type CheckViolationsInput } from "./checkViolations";
import { asEmployeeId, asPlanId } from "../types/ids";
import type { AssignedShift, HeadcountRequirement, RequestedLeave } from "../types/shift";
import type { WorkRule } from "../types/workRule";

const planId = asPlanId("plan-1");

function makeShift(
  employeeId: string,
  date: string,
  shiftType: AssignedShift["shiftType"],
  start: string | null = null,
  end: string | null = null,
  hours = 0,
): AssignedShift {
  return {
    employeeId: asEmployeeId(employeeId),
    planId,
    date,
    shiftType,
    startTime: start,
    endTime: end,
    hours,
  };
}

function baseInput(overrides: Partial<CheckViolationsInput> = {}): CheckViolationsInput {
  return {
    assignedShifts: [],
    requestedLeaves: [],
    headcountRequirements: [],
    workRule: null,
    ...overrides,
  };
}

describe("checkViolations - unmet_leave_request", () => {
  it("flags a work shift on a requested leave date", () => {
    const requestedLeaves: RequestedLeave[] = [
      { employeeId: asEmployeeId("e1"), planId, date: "2026-09-05" },
    ];
    const assignedShifts = [makeShift("e1", "2026-09-05", "work", "09:00", "17:00", 8)];

    const violations = checkViolations(baseInput({ requestedLeaves, assignedShifts }));

    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe("unmet_leave_request");
    expect(violations[0].employeeId).toBe("e1");
  });

  it("does not flag when the leave date has no work shift", () => {
    const requestedLeaves: RequestedLeave[] = [
      { employeeId: asEmployeeId("e1"), planId, date: "2026-09-05" },
    ];
    const assignedShifts = [makeShift("e1", "2026-09-05", "leave")];

    const violations = checkViolations(baseInput({ requestedLeaves, assignedShifts }));
    expect(violations).toHaveLength(0);
  });
});

describe("checkViolations - max_consecutive_days", () => {
  const workRule: WorkRule = { maxConsecutiveWorkDays: 5, maxWeeklyHours: null };

  it("does not flag exactly the boundary (5 consecutive days)", () => {
    const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"];
    const assignedShifts = dates.map((d) => makeShift("e1", d, "work", "09:00", "17:00", 8));

    const violations = checkViolations(baseInput({ assignedShifts, workRule }));
    expect(violations.filter((v) => v.type === "max_consecutive_days")).toHaveLength(0);
  });

  it("flags 6 consecutive days when the limit is 5", () => {
    const dates = [
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ];
    const assignedShifts = dates.map((d) => makeShift("e1", d, "work", "09:00", "17:00", 8));

    const violations = checkViolations(baseInput({ assignedShifts, workRule }));
    const consecutive = violations.filter((v) => v.type === "max_consecutive_days");
    expect(consecutive).toHaveLength(1);
    expect(consecutive[0].dates).toEqual(dates);
  });

  it("does not double count separate short runs", () => {
    const assignedShifts = [
      makeShift("e1", "2026-09-01", "work", "09:00", "17:00", 8),
      makeShift("e1", "2026-09-02", "work", "09:00", "17:00", 8),
      // gap
      makeShift("e1", "2026-09-05", "work", "09:00", "17:00", 8),
      makeShift("e1", "2026-09-06", "work", "09:00", "17:00", 8),
    ];
    const violations = checkViolations(baseInput({ assignedShifts, workRule }));
    expect(violations.filter((v) => v.type === "max_consecutive_days")).toHaveLength(0);
  });
});

describe("checkViolations - max_weekly_hours", () => {
  const workRule: WorkRule = { maxConsecutiveWorkDays: null, maxWeeklyHours: 40 };

  it("does not flag exactly the boundary (40 hours in one week)", () => {
    // 2026-08-30 (Sun) - 2026-09-05 (Sat) is one week; 5 * 8 = 40
    const dates = ["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03"];
    const assignedShifts = dates.map((d) => makeShift("e1", d, "work", "09:00", "17:00", 8));

    const violations = checkViolations(baseInput({ assignedShifts, workRule }));
    expect(violations.filter((v) => v.type === "max_weekly_hours")).toHaveLength(0);
  });

  it("flags when weekly hours exceed the limit", () => {
    const dates = ["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"];
    const assignedShifts = dates.map((d) => makeShift("e1", d, "work", "09:00", "17:00", 8));

    const violations = checkViolations(baseInput({ assignedShifts, workRule }));
    const weekly = violations.filter((v) => v.type === "max_weekly_hours");
    expect(weekly).toHaveLength(1);
  });
});

describe("checkViolations - understaffed_slot", () => {
  it("flags a slot with fewer assigned employees than required", () => {
    const headcountRequirements: HeadcountRequirement[] = [
      {
        id: "h1",
        planId,
        date: "2026-09-05",
        startTime: "09:00:00",
        endTime: "17:00:00",
        requiredCount: 2,
      },
    ];
    const assignedShifts = [makeShift("e1", "2026-09-05", "work", "09:00", "17:00", 8)];

    const violations = checkViolations(baseInput({ assignedShifts, headcountRequirements }));
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe("understaffed_slot");
    expect(violations[0].slotId).toBe("h1");
  });

  it("does not flag when enough employees cover the slot", () => {
    const headcountRequirements: HeadcountRequirement[] = [
      {
        id: "h1",
        planId,
        date: "2026-09-05",
        startTime: "09:00:00",
        endTime: "17:00:00",
        requiredCount: 2,
      },
    ];
    const assignedShifts = [
      makeShift("e1", "2026-09-05", "work", "09:00", "17:00", 8),
      makeShift("e2", "2026-09-05", "work", "08:00", "18:00", 10),
    ];

    const violations = checkViolations(baseInput({ assignedShifts, headcountRequirements }));
    expect(violations).toHaveLength(0);
  });

  it("does not count a shift that only partially covers the required slot", () => {
    const headcountRequirements: HeadcountRequirement[] = [
      {
        id: "h1",
        planId,
        date: "2026-09-05",
        startTime: "09:00:00",
        endTime: "17:00:00",
        requiredCount: 1,
      },
    ];
    // Shift ends at 12:00, before the required slot's 17:00 end - does not fully cover.
    const assignedShifts = [makeShift("e1", "2026-09-05", "work", "09:00", "12:00", 3)];

    const violations = checkViolations(baseInput({ assignedShifts, headcountRequirements }));
    expect(violations).toHaveLength(1);
  });
});

describe("checkViolations - rule not configured is skipped", () => {
  it("does not flag consecutive days or weekly hours when work_rules is null", () => {
    const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"];
    const assignedShifts = dates.map((d) => makeShift("e1", d, "work", "09:00", "20:00", 11));

    const violations = checkViolations(baseInput({ assignedShifts, workRule: null }));
    expect(violations.filter((v) => v.type === "max_consecutive_days")).toHaveLength(0);
    expect(violations.filter((v) => v.type === "max_weekly_hours")).toHaveLength(0);
  });

  it("returns no violations and represents a clean plan", () => {
    const violations = checkViolations(baseInput());
    expect(violations).toHaveLength(0);
  });
});

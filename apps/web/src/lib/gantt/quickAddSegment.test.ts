import { describe, expect, it } from "vitest";
import { asEmployeeId, asPlanId, asWorkTaskId } from "@shifuto/shared-core";
import type { TaskSegment } from "@shifuto/shared-core";
import { computeQuickAddEnd } from "./quickAddSegment";

const planId = asPlanId("2026-09");
const employeeId = asEmployeeId("emp-1");
const taskA = asWorkTaskId("task-a");

function segment(overrides: Partial<TaskSegment>): TaskSegment {
  return { id: "seg", planId, employeeId, date: "2026-09-01", taskId: taskA, startTime: "08:00", endTime: "09:00", ...overrides };
}

describe("computeQuickAddEnd", () => {
  it("returns a full 60-minute end time when the timeline is empty", () => {
    expect(computeQuickAddEnd([], "10:00", "22:00")).toBe("11:00");
  });

  it("clips to gridEnd when the hour would run past it", () => {
    expect(computeQuickAddEnd([], "21:30", "22:00")).toBe("22:00");
  });

  it("clips to the next segment's start when it's within the hour", () => {
    const next = segment({ id: "b", startTime: "10:30", endTime: "11:00" });
    expect(computeQuickAddEnd([next], "10:00", "22:00")).toBe("10:30");
  });

  it("returns null when startTime already falls inside an existing segment", () => {
    const existing = segment({ id: "a", startTime: "09:00", endTime: "10:00" });
    expect(computeQuickAddEnd([existing], "09:30", "22:00")).toBeNull();
  });

  it("returns null when there's no room left before the next segment", () => {
    const next = segment({ id: "b", startTime: "10:00", endTime: "11:00" });
    expect(computeQuickAddEnd([next], "10:00", "22:00")).toBeNull();
  });
});

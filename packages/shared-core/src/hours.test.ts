import { describe, expect, it } from "vitest";
import { computeShiftHours, summarizeTaskSegments } from "./hours";
import { asEmployeeId, asPlanId } from "./types/ids";
import { asWorkTaskId, type TaskSegment } from "./types/task";

describe("computeShiftHours", () => {
  it("computes hours for a work shift", () => {
    expect(computeShiftHours("work", "09:00", "17:30")).toBe(8.5);
  });

  it("returns 0 for non-work shift types", () => {
    expect(computeShiftHours("leave", "09:00", "17:00")).toBe(0);
  });
});

const employeeId = asEmployeeId("emp-1");
const planId = asPlanId("2026-09");
const taskA = asWorkTaskId("task-a");

function segment(overrides: Partial<TaskSegment>): TaskSegment {
  return {
    id: "seg-1",
    planId,
    employeeId,
    date: "2026-09-02",
    taskId: taskA,
    startTime: "09:00",
    endTime: "10:00",
    ...overrides,
  };
}

describe("summarizeTaskSegments", () => {
  it("returns null for an empty list", () => {
    expect(summarizeTaskSegments([])).toBeNull();
  });

  it("spans the earliest start to the latest end, and excludes breaks from worked hours", () => {
    const segments = [
      segment({ id: "1", startTime: "09:00", endTime: "12:00", taskId: taskA }),
      segment({ id: "2", startTime: "12:00", endTime: "13:00", taskId: null }), // break
      segment({ id: "3", startTime: "13:00", endTime: "17:00", taskId: taskA }),
    ];
    expect(summarizeTaskSegments(segments)).toEqual({
      startTime: "09:00",
      endTime: "17:00",
      hours: 7, // 3h + 4h, break excluded
    });
  });
});

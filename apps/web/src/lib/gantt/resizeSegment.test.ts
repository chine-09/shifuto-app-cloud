import { describe, expect, it } from "vitest";
import { asEmployeeId, asPlanId, asWorkTaskId } from "@shifuto/shared-core";
import type { TaskSegment } from "@shifuto/shared-core";
import { resizeSegmentWithNeighbors } from "./resizeSegment";

const planId = asPlanId("2026-09");
const employeeId = asEmployeeId("emp-1");
const taskA = asWorkTaskId("task-a");
const taskB = asWorkTaskId("task-b");

function segment(overrides: Partial<TaskSegment>): TaskSegment {
  return { id: "seg", planId, employeeId, date: "2026-09-01", taskId: taskA, startTime: "08:00", endTime: "09:00", ...overrides };
}

describe("resizeSegmentWithNeighbors", () => {
  it("drags the touching neighbor's boundary along when the moved edge was adjacent to it", () => {
    const a = segment({ id: "a", taskId: taskA, startTime: "08:00", endTime: "09:00" });
    const b = segment({ id: "b", taskId: taskB, startTime: "09:00", endTime: "13:00" });

    const result = resizeSegmentWithNeighbors([a, b], "a", "08:00", "10:00");

    expect(result).not.toBeNull();
    const byId = new Map(result!.map((s) => [s.id, s]));
    expect(byId.get("a")).toMatchObject({ startTime: "08:00", endTime: "10:00" });
    expect(byId.get("b")).toMatchObject({ startTime: "10:00", endTime: "13:00" });
  });

  it("rejects a resize that would push past a non-adjacent segment", () => {
    const a = segment({ id: "a", startTime: "08:00", endTime: "09:00" });
    const b = segment({ id: "b", startTime: "09:00", endTime: "10:00" });
    const c = segment({ id: "c", startTime: "10:00", endTime: "11:00" });

    // extending "a" to 10:30 would push "b" to end at 10:30, past "c"'s start (10:00)
    const result = resizeSegmentWithNeighbors([a, b, c], "a", "08:00", "10:30");
    expect(result).toBeNull();
  });

  it("rejects a resize that inverts the segment", () => {
    const a = segment({ id: "a", startTime: "08:00", endTime: "09:00" });
    const result = resizeSegmentWithNeighbors([a], "a", "10:00", "09:00");
    expect(result).toBeNull();
  });

  it("leaves unrelated segments untouched", () => {
    const a = segment({ id: "a", startTime: "08:00", endTime: "09:00" });
    const b = segment({ id: "b", startTime: "12:00", endTime: "13:00" }); // not adjacent
    const result = resizeSegmentWithNeighbors([a, b], "a", "08:00", "09:30");
    const byId = new Map(result!.map((s) => [s.id, s]));
    expect(byId.get("b")).toMatchObject({ startTime: "12:00", endTime: "13:00" });
  });
});

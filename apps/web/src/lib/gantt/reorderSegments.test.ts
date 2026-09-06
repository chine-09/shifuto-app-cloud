import { describe, expect, it } from "vitest";
import { asEmployeeId, asPlanId, asWorkTaskId } from "@shifuto/shared-core";
import type { TaskSegment } from "@shifuto/shared-core";
import { stepReorder } from "./reorderSegments";

const planId = asPlanId("2026-09");
const employeeId = asEmployeeId("emp-1");
const taskA = asWorkTaskId("task-a");
const taskB = asWorkTaskId("task-b");
const taskC = asWorkTaskId("task-c");

function segment(overrides: Partial<TaskSegment>): TaskSegment {
  return { id: "seg", planId, employeeId, date: "2026-09-01", taskId: taskA, startTime: "08:00", endTime: "09:00", ...overrides };
}

describe("stepReorder", () => {
  it("swaps a dragged segment with its right neighbor once the cursor passes the neighbor's midpoint, preserving each segment's own duration", () => {
    // 品出し 08:00-09:00 (1h), レジ 09:00-13:00 (4h)
    const a = segment({ id: "a", taskId: taskA, startTime: "08:00", endTime: "09:00" });
    const b = segment({ id: "b", taskId: taskB, startTime: "09:00", endTime: "13:00" });

    // Dragging "a" (the 1h block) rightward past b's midpoint (11:00)
    const result = stepReorder([a, b], "a", "11:30");

    const byId = new Map(result.map((s) => [s.id, s]));
    // b (4h) now comes first from the original anchor (08:00), a (1h) follows
    expect(byId.get("b")).toMatchObject({ startTime: "08:00", endTime: "12:00" });
    expect(byId.get("a")).toMatchObject({ startTime: "12:00", endTime: "13:00" });
  });

  it("swaps with the left neighbor when dragged past its midpoint", () => {
    const a = segment({ id: "a", taskId: taskA, startTime: "08:00", endTime: "09:00" });
    const b = segment({ id: "b", taskId: taskB, startTime: "09:00", endTime: "13:00" });

    const result = stepReorder([a, b], "b", "08:15"); // b's cursor before a's midpoint (08:30)
    const byId = new Map(result.map((s) => [s.id, s]));
    expect(byId.get("b")).toMatchObject({ startTime: "08:00", endTime: "12:00" });
    expect(byId.get("a")).toMatchObject({ startTime: "12:00", endTime: "13:00" });
  });

  it("is a no-op (same reference) when nothing should move", () => {
    const a = segment({ id: "a", startTime: "08:00", endTime: "09:00" });
    const b = segment({ id: "b", startTime: "09:00", endTime: "13:00" });
    const input = [a, b];
    expect(stepReorder(input, "a", "09:15")).toBe(input);
  });

  it("cascades through a middle segment across two calls (simulating continued drag)", () => {
    const a = segment({ id: "a", taskId: taskA, startTime: "08:00", endTime: "09:00" });
    const b = segment({ id: "b", taskId: taskB, startTime: "09:00", endTime: "10:00" });
    const c = segment({ id: "c", taskId: taskC, startTime: "10:00", endTime: "11:00" });

    // First step: dragging "a" past b's midpoint (09:30) -> order becomes b, a, c
    const step1 = stepReorder([a, b, c], "a", "09:31");
    let byId = new Map(step1.map((s) => [s.id, s]));
    expect(byId.get("b")).toMatchObject({ startTime: "08:00", endTime: "09:00" });
    expect(byId.get("a")).toMatchObject({ startTime: "09:00", endTime: "10:00" });
    expect(byId.get("c")).toMatchObject({ startTime: "10:00", endTime: "11:00" });

    // Second step: continue dragging "a" past c's midpoint (10:30) -> order becomes b, c, a
    const step2 = stepReorder(step1, "a", "10:31");
    byId = new Map(step2.map((s) => [s.id, s]));
    expect(byId.get("b")).toMatchObject({ startTime: "08:00", endTime: "09:00" });
    expect(byId.get("c")).toMatchObject({ startTime: "09:00", endTime: "10:00" });
    expect(byId.get("a")).toMatchObject({ startTime: "10:00", endTime: "11:00" });
  });
});

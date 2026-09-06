import { describe, expect, it } from "vitest";
import { asEmployeeId, asPlanId, asWorkTaskId } from "@shifuto/shared-core";
import { appReducer } from "./appReducer";
import { createInitialState } from "./types";

const planId = asPlanId("2026-09");
const emp1 = asEmployeeId("e1");
const emp2 = asEmployeeId("e2");

describe("appReducer", () => {
  it("marks state dirty on any mutation and clean on MARK_SAVED / IMPORT_STATE", () => {
    let state = createInitialState();
    expect(state.meta.isDirty).toBe(false);

    state = appReducer(state, { type: "UPDATE_STORE_NAME", name: "テスト店舗" });
    expect(state.meta.isDirty).toBe(true);

    state = appReducer(state, { type: "MARK_SAVED" });
    expect(state.meta.isDirty).toBe(false);
  });

  it("upserts and clears a single shift cell", () => {
    let state = createInitialState();
    state = appReducer(state, {
      type: "UPSERT_SHIFT",
      shift: { employeeId: emp1, planId, date: "2026-09-01", shiftType: "work", startTime: "09:00", endTime: "17:00", hours: 8 },
    });
    expect(state.assignedShifts).toHaveLength(1);

    // upserting the same employee+plan+date replaces, not appends
    state = appReducer(state, {
      type: "UPSERT_SHIFT",
      shift: { employeeId: emp1, planId, date: "2026-09-01", shiftType: "leave", startTime: null, endTime: null, hours: 0 },
    });
    expect(state.assignedShifts).toHaveLength(1);
    expect(state.assignedShifts[0].shiftType).toBe("leave");

    state = appReducer(state, { type: "CLEAR_SHIFT", planId, employeeId: emp1, date: "2026-09-01" });
    expect(state.assignedShifts).toHaveLength(0);
  });

  it("bulk clears only the targeted employee/date pairs", () => {
    let state = createInitialState();
    state = appReducer(state, {
      type: "BULK_UPSERT_SHIFTS",
      shifts: [
        { employeeId: emp1, planId, date: "2026-09-01", shiftType: "work", startTime: "09:00", endTime: "17:00", hours: 8 },
        { employeeId: emp2, planId, date: "2026-09-01", shiftType: "work", startTime: "09:00", endTime: "17:00", hours: 8 },
      ],
    });
    expect(state.assignedShifts).toHaveLength(2);

    state = appReducer(state, {
      type: "BULK_CLEAR_SHIFTS",
      planId,
      targets: [{ employeeId: emp1, date: "2026-09-01" }],
    });
    expect(state.assignedShifts).toHaveLength(1);
    expect(state.assignedShifts[0].employeeId).toBe(emp2);
  });

  it("replaces only the target plan's leaves", () => {
    let state = createInitialState();
    const otherPlanId = asPlanId("2026-10");
    state = appReducer(state, {
      type: "REPLACE_LEAVES_FOR_PLAN",
      planId: otherPlanId,
      leaves: [{ employeeId: emp1, planId: otherPlanId, date: "2026-10-05" }],
    });
    state = appReducer(state, {
      type: "REPLACE_LEAVES_FOR_PLAN",
      planId,
      leaves: [{ employeeId: emp1, planId, date: "2026-09-05" }],
    });
    expect(state.requestedLeaves).toHaveLength(2);

    // replacing this plan's leaves again drops the old set for this plan only
    state = appReducer(state, { type: "REPLACE_LEAVES_FOR_PLAN", planId, leaves: [] });
    expect(state.requestedLeaves).toEqual([{ employeeId: emp1, planId: otherPlanId, date: "2026-10-05" }]);
  });

  it("REPLACE_TASK_SEGMENTS_FOR_DAY replaces that day's segments and syncs the coarse AssignedShift", () => {
    let state = createInitialState();
    const taskA = asWorkTaskId("task-a");

    state = appReducer(state, {
      type: "REPLACE_TASK_SEGMENTS_FOR_DAY",
      planId,
      employeeId: emp1,
      date: "2026-09-02",
      segments: [
        { id: "s1", planId, employeeId: emp1, date: "2026-09-02", taskId: taskA, startTime: "09:00", endTime: "12:00" },
        { id: "s2", planId, employeeId: emp1, date: "2026-09-02", taskId: null, startTime: "12:00", endTime: "13:00" },
        { id: "s3", planId, employeeId: emp1, date: "2026-09-02", taskId: taskA, startTime: "13:00", endTime: "17:00" },
      ],
    });
    expect(state.taskSegments).toHaveLength(3);
    expect(state.assignedShifts).toHaveLength(1);
    expect(state.assignedShifts[0]).toMatchObject({ startTime: "09:00", endTime: "17:00", hours: 7, shiftType: "work" });

    // replacing with an empty list clears both the segments and the derived shift
    state = appReducer(state, {
      type: "REPLACE_TASK_SEGMENTS_FOR_DAY",
      planId,
      employeeId: emp1,
      date: "2026-09-02",
      segments: [],
    });
    expect(state.taskSegments).toHaveLength(0);
    expect(state.assignedShifts).toHaveLength(0);
  });

  it("IMPORT_STATE replaces the whole tree and resets isDirty", () => {
    const imported = { ...createInitialState(), meta: { isDirty: true, storeName: "インポート店" } };
    const next = appReducer(createInitialState(), { type: "IMPORT_STATE", state: imported });
    expect(next.meta.storeName).toBe("インポート店");
    expect(next.meta.isDirty).toBe(false);
  });
});

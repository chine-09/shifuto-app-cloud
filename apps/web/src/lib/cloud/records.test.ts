import { describe, expect, it } from "vitest";
import { asEmployeeId, asPlanId, asWorkTaskId, planIdFor } from "@shifuto/shared-core";
import { appReducer } from "../../state/appReducer";
import { createInitialState } from "../../state/types";
import { toRecords, fromRecords, MASTER_SK } from "./records";

const planId = asPlanId(planIdFor(2026, 9));
const emp1 = asEmployeeId("e1");
const taskA = asWorkTaskId("task-a");

function buildFixtureState() {
  let state = createInitialState();
  state = appReducer(state, { type: "UPDATE_STORE_NAME", name: "テスト店舗" });
  state = appReducer(state, {
    type: "UPSERT_EMPLOYEE",
    employee: { id: emp1, name: "上田花子", role: null, employmentType: "part_time", isActive: true, sortOrder: 0 },
  });
  state = appReducer(state, { type: "UPSERT_PLAN", plan: { id: planId, year: 2026, month: 9 } });
  state = appReducer(state, {
    type: "UPSERT_HEADCOUNT",
    requirement: { id: "h1", planId, date: "2026-09-01", startTime: "09:00:00", endTime: "17:00:00", requiredCount: 2 },
  });
  state = appReducer(state, {
    type: "REPLACE_LEAVES_FOR_PLAN",
    planId,
    leaves: [{ employeeId: emp1, planId, date: "2026-09-05" }],
  });
  state = appReducer(state, {
    type: "UPSERT_SHIFT",
    shift: { employeeId: emp1, planId, date: "2026-09-01", shiftType: "work", startTime: "09:00", endTime: "17:00", hours: 8 },
  });
  state = appReducer(state, { type: "UPSERT_WORK_TASK", workTask: { id: taskA, name: "レジ", color: "#4ade80" } });
  state = appReducer(state, {
    type: "REPLACE_TASK_SEGMENTS_FOR_DAY",
    planId,
    employeeId: emp1,
    date: "2026-09-01",
    segments: [{ id: "s1", planId, employeeId: emp1, date: "2026-09-01", taskId: taskA, startTime: "09:00", endTime: "17:00" }],
  });
  return state;
}

describe("toRecords / fromRecords", () => {
  it("splits state into MASTER, MONTH#<planId>, and DAY#<date> records", () => {
    const state = buildFixtureState();
    const records = toRecords(state);
    const skSet = new Set(records.map((r) => r.sk));

    expect(skSet.has(MASTER_SK)).toBe(true);
    expect(skSet.has(`MONTH#${planId}`)).toBe(true);
    expect(skSet.has("DAY#2026-09-01")).toBe(true);
    // 2026-09-05 only has a requested leave, no assigned shift / task segment — no DAY record for it.
    expect(skSet.has("DAY#2026-09-05")).toBe(false);
  });

  it("round-trips through toRecords -> fromRecords back to an equivalent AppState", () => {
    const state = buildFixtureState();
    const roundTripped = fromRecords(toRecords(state));

    expect(roundTripped.meta.storeName).toBe(state.meta.storeName);
    expect(roundTripped.employees).toEqual(state.employees);
    expect(roundTripped.plans).toEqual(state.plans);
    expect(roundTripped.headcountRequirements).toEqual(state.headcountRequirements);
    expect(roundTripped.requestedLeaves).toEqual(state.requestedLeaves);
    expect(roundTripped.assignedShifts).toEqual(state.assignedShifts);
    expect(roundTripped.workTasks).toEqual(state.workTasks);
    expect(roundTripped.taskSegments).toEqual(state.taskSegments);
  });

  it("fromRecords on an empty list produces the same shape as createInitialState (isDirty aside)", () => {
    const materialized = fromRecords([]);
    const initial = createInitialState();
    expect(materialized.employees).toEqual(initial.employees);
    expect(materialized.plans).toEqual(initial.plans);
    expect(materialized.meta.storeName).toBe(initial.meta.storeName);
  });
});

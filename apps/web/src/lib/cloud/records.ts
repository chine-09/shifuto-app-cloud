import type {
  AssignedShift,
  HeadcountRequirement,
  MonthlyPlan,
  PiiEmployee,
  RequestedLeave,
  TaskSegment,
  WorkRule,
  WorkTask,
} from "@shifuto/shared-core";
import { createInitialState, type AppState } from "../../state/types";

export const MASTER_SK = "MASTER";

/** One (sk, data) pair as stored in / read from DynamoDB — see apps/api/src/handlers/state.ts. */
export type CloudRecord = { sk: string; data: unknown };

type MasterData = {
  storeName: string;
  employees: PiiEmployee[];
  workRule: WorkRule | null;
  workTasks: WorkTask[];
};

type MonthData = {
  plan: MonthlyPlan;
  headcountRequirements: HeadcountRequirement[];
  requestedLeaves: RequestedLeave[];
};

type DayData = {
  assignedShifts: AssignedShift[];
  taskSegments: TaskSegment[];
};

/**
 * Splits the app's single in-memory AppState into the normalized records
 * the cloud store keeps (see docs/SPEC.md and apps/api/src/handlers/state.ts):
 * one MASTER record, one MONTH#<planId> record per shift plan, and one
 * DAY#<date> record per date that actually has assigned shifts or task
 * segments (a date with none simply produces no record — see
 * useCloudSync.ts for how a date that *used to* have data gets its record
 * explicitly cleared rather than left stale in the cloud).
 */
export function toRecords(state: AppState): CloudRecord[] {
  const records: CloudRecord[] = [
    {
      sk: MASTER_SK,
      data: {
        storeName: state.meta.storeName,
        employees: state.employees,
        workRule: state.workRule,
        workTasks: state.workTasks,
      } satisfies MasterData,
    },
  ];

  for (const plan of state.plans) {
    records.push({
      sk: `MONTH#${plan.id}`,
      data: {
        plan,
        headcountRequirements: state.headcountRequirements.filter((r) => r.planId === plan.id),
        requestedLeaves: state.requestedLeaves.filter((l) => l.planId === plan.id),
      } satisfies MonthData,
    });
  }

  const dates = new Set<string>([...state.assignedShifts.map((s) => s.date), ...state.taskSegments.map((s) => s.date)]);
  for (const date of dates) {
    records.push({
      sk: `DAY#${date}`,
      data: {
        assignedShifts: state.assignedShifts.filter((s) => s.date === date),
        taskSegments: state.taskSegments.filter((s) => s.date === date),
      } satisfies DayData,
    });
  }

  return records;
}

/** Inverse of toRecords: reassembles the flat record list the cloud returns back into one AppState. */
export function fromRecords(records: CloudRecord[]): AppState {
  const state = createInitialState();

  for (const { sk, data } of records) {
    if (sk === MASTER_SK) {
      const d = data as Partial<MasterData>;
      state.meta.storeName = d.storeName ?? "";
      state.employees = d.employees ?? [];
      state.workRule = d.workRule ?? null;
      state.workTasks = d.workTasks ?? [];
    } else if (sk.startsWith("MONTH#")) {
      const d = data as Partial<MonthData>;
      if (d.plan) state.plans.push(d.plan);
      state.headcountRequirements.push(...(d.headcountRequirements ?? []));
      state.requestedLeaves.push(...(d.requestedLeaves ?? []));
    } else if (sk.startsWith("DAY#")) {
      const d = data as Partial<DayData>;
      state.assignedShifts.push(...(d.assignedShifts ?? []));
      state.taskSegments.push(...(d.taskSegments ?? []));
    }
  }

  return state;
}

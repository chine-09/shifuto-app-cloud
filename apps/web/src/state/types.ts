import type {
  AssignedShift,
  EmployeeId,
  HeadcountRequirement,
  MonthlyPlan,
  PiiEmployee,
  PlanId,
  RequestedLeave,
  WorkRule,
} from "@shifuto/shared-core";

export type AppState = {
  version: 1;
  meta: {
    isDirty: boolean;
    storeName: string;
  };
  employees: PiiEmployee[];
  plans: MonthlyPlan[];
  assignedShifts: AssignedShift[];
  requestedLeaves: RequestedLeave[];
  headcountRequirements: HeadcountRequirement[];
  workRule: WorkRule | null;
};

export function createInitialState(): AppState {
  return {
    version: 1,
    meta: { isDirty: false, storeName: "" },
    employees: [],
    plans: [],
    assignedShifts: [],
    requestedLeaves: [],
    headcountRequirements: [],
    workRule: null,
  };
}

export type AppAction =
  | { type: "UPDATE_STORE_NAME"; name: string }
  | { type: "UPSERT_EMPLOYEE"; employee: PiiEmployee }
  | { type: "DELETE_EMPLOYEE"; id: EmployeeId }
  | { type: "UPSERT_PLAN"; plan: MonthlyPlan }
  | { type: "UPSERT_SHIFT"; shift: AssignedShift }
  | { type: "CLEAR_SHIFT"; planId: PlanId; employeeId: EmployeeId; date: string }
  | { type: "BULK_UPSERT_SHIFTS"; shifts: AssignedShift[] }
  | { type: "REPLACE_SHIFTS_FOR_PLAN"; planId: PlanId; shifts: AssignedShift[] }
  | {
      type: "BULK_CLEAR_SHIFTS";
      planId: PlanId;
      targets: { employeeId: EmployeeId; date: string }[];
    }
  | { type: "REPLACE_LEAVES_FOR_PLAN"; planId: PlanId; leaves: RequestedLeave[] }
  | { type: "UPSERT_HEADCOUNT"; requirement: HeadcountRequirement }
  | { type: "BULK_UPSERT_HEADCOUNT"; requirements: HeadcountRequirement[] }
  | { type: "DELETE_HEADCOUNT"; id: string }
  | { type: "UPDATE_WORK_RULE"; workRule: WorkRule }
  | { type: "IMPORT_STATE"; state: AppState }
  | { type: "MARK_SAVED" }
  | { type: "UNDO" };

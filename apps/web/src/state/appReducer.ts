import type { AppAction, AppState } from "./types";

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [...list, item];
  const next = [...list];
  next[idx] = item;
  return next;
}

function shiftKey(employeeId: string, planId: string, date: string): string {
  return `${planId}_${employeeId}_${date}`;
}

function upsertShifts(list: AppState["assignedShifts"], incoming: AppState["assignedShifts"]) {
  const byKey = new Map(list.map((s) => [shiftKey(s.employeeId, s.planId, s.date), s]));
  for (const shift of incoming) {
    byKey.set(shiftKey(shift.employeeId, shift.planId, shift.date), shift);
  }
  return [...byKey.values()];
}

/** Pure reducer: every mutation the UI can make to local app state. */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "UPDATE_STORE_NAME":
      return { ...state, meta: { ...state.meta, storeName: action.name, isDirty: true } };

    case "UPSERT_EMPLOYEE":
      return {
        ...state,
        employees: upsertById(state.employees, action.employee),
        meta: { ...state.meta, isDirty: true },
      };

    case "DELETE_EMPLOYEE":
      return {
        ...state,
        employees: state.employees.filter((e) => e.id !== action.id),
        meta: { ...state.meta, isDirty: true },
      };

    case "UPSERT_PLAN":
      return {
        ...state,
        plans: upsertById(state.plans, action.plan),
        meta: { ...state.meta, isDirty: true },
      };

    case "UPSERT_SHIFT":
      return {
        ...state,
        assignedShifts: upsertShifts(state.assignedShifts, [action.shift]),
        meta: { ...state.meta, isDirty: true },
      };

    case "CLEAR_SHIFT":
      return {
        ...state,
        assignedShifts: state.assignedShifts.filter(
          (s) =>
            !(
              s.planId === action.planId &&
              s.employeeId === action.employeeId &&
              s.date === action.date
            ),
        ),
        meta: { ...state.meta, isDirty: true },
      };

    case "BULK_UPSERT_SHIFTS":
      return {
        ...state,
        assignedShifts: upsertShifts(state.assignedShifts, action.shifts),
        meta: { ...state.meta, isDirty: true },
      };

    case "REPLACE_SHIFTS_FOR_PLAN":
      return {
        ...state,
        assignedShifts: [
          ...state.assignedShifts.filter((s) => s.planId !== action.planId),
          ...action.shifts,
        ],
        meta: { ...state.meta, isDirty: true },
      };

    case "BULK_CLEAR_SHIFTS": {
      const targetKeys = new Set(
        action.targets.map((t) => shiftKey(t.employeeId, action.planId, t.date)),
      );
      return {
        ...state,
        assignedShifts: state.assignedShifts.filter(
          (s) => !targetKeys.has(shiftKey(s.employeeId, s.planId, s.date)),
        ),
        meta: { ...state.meta, isDirty: true },
      };
    }

    case "REPLACE_LEAVES_FOR_PLAN":
      return {
        ...state,
        requestedLeaves: [
          ...state.requestedLeaves.filter((l) => l.planId !== action.planId),
          ...action.leaves,
        ],
        meta: { ...state.meta, isDirty: true },
      };

    case "UPSERT_HEADCOUNT":
      return {
        ...state,
        headcountRequirements: upsertById(state.headcountRequirements, action.requirement),
        meta: { ...state.meta, isDirty: true },
      };

    case "BULK_UPSERT_HEADCOUNT": {
      let next = state.headcountRequirements;
      for (const req of action.requirements) next = upsertById(next, req);
      return { ...state, headcountRequirements: next, meta: { ...state.meta, isDirty: true } };
    }

    case "DELETE_HEADCOUNT":
      return {
        ...state,
        headcountRequirements: state.headcountRequirements.filter((r) => r.id !== action.id),
        meta: { ...state.meta, isDirty: true },
      };

    case "UPDATE_WORK_RULE":
      return { ...state, workRule: action.workRule, meta: { ...state.meta, isDirty: true } };

    case "IMPORT_STATE":
      return { ...action.state, meta: { ...action.state.meta, isDirty: false } };

    case "MARK_SAVED":
      return { ...state, meta: { ...state.meta, isDirty: false } };

    default:
      return state;
  }
}

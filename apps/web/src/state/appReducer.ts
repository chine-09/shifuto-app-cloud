import { summarizeTaskSegments, type AssignedShift } from "@shifuto/shared-core";
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

    case "UPSERT_WORK_TASK":
      return {
        ...state,
        workTasks: upsertById(state.workTasks, action.workTask),
        meta: { ...state.meta, isDirty: true },
      };

    case "DELETE_WORK_TASK":
      return {
        ...state,
        workTasks: state.workTasks.filter((t) => t.id !== action.id),
        // Segments referencing a deleted task become breaks rather than
        // dangling on a task id that no longer resolves to a name/color.
        taskSegments: state.taskSegments.map((s) => (s.taskId === action.id ? { ...s, taskId: null } : s)),
        meta: { ...state.meta, isDirty: true },
      };

    case "REPLACE_TASK_SEGMENTS_FOR_DAY": {
      const { planId, employeeId, date, segments } = action;
      const nextTaskSegments = [
        ...state.taskSegments.filter(
          (s) => !(s.planId === planId && s.employeeId === employeeId && s.date === date),
        ),
        ...segments,
      ];

      // Keep the coarse AssignedShift (used by violation checks, Excel
      // export, weekly-hours totals) in sync with what the detailed segments
      // now imply, so the simple shift table and this detailed view never
      // disagree about the same day.
      const summary = summarizeTaskSegments(segments);
      const key = shiftKey(employeeId, planId, date);
      const nextAssignedShifts = state.assignedShifts.filter(
        (s) => shiftKey(s.employeeId, s.planId, s.date) !== key,
      );
      if (summary) {
        const shift: AssignedShift = {
          employeeId,
          planId,
          date,
          shiftType: "work",
          startTime: summary.startTime,
          endTime: summary.endTime,
          hours: summary.hours,
        };
        nextAssignedShifts.push(shift);
      }

      return {
        ...state,
        taskSegments: nextTaskSegments,
        assignedShifts: nextAssignedShifts,
        meta: { ...state.meta, isDirty: true },
      };
    }

    case "IMPORT_STATE":
      return { ...action.state, meta: { ...action.state.meta, isDirty: false } };

    case "MARK_SAVED":
      return { ...state, meta: { ...state.meta, isDirty: false } };

    default:
      return state;
  }
}

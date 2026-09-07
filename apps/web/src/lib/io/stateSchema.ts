import { z } from "zod";
import type { AppState } from "../../state/types";

const employeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().nullable(),
  employmentType: z.enum(["full_time", "part_time"]),
  isActive: z.boolean(),
  sortOrder: z.number(),
});

const planSchema = z.object({
  id: z.string(),
  year: z.number(),
  month: z.number(),
});

const shiftSchema = z.object({
  employeeId: z.string(),
  planId: z.string(),
  date: z.string(),
  shiftType: z.enum(["work", "leave", "off"]),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  hours: z.number(),
});

const leaveSchema = z.object({
  employeeId: z.string(),
  planId: z.string(),
  date: z.string(),
});

const headcountSchema = z.object({
  id: z.string(),
  planId: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  requiredCount: z.number(),
});

const workRuleSchema = z
  .object({
    maxConsecutiveWorkDays: z.number().nullable(),
    maxWeeklyHours: z.number().nullable(),
  })
  .nullable();

const workTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

const taskSegmentSchema = z.object({
  id: z.string(),
  planId: z.string(),
  employeeId: z.string(),
  date: z.string(),
  taskId: z.string().nullable(),
  startTime: z.string(),
  endTime: z.string(),
});

export const appStateSchema = z.object({
  version: z.literal(1),
  meta: z.object({
    isDirty: z.boolean(),
    storeName: z.string(),
  }),
  employees: z.array(employeeSchema),
  plans: z.array(planSchema),
  assignedShifts: z.array(shiftSchema),
  requestedLeaves: z.array(leaveSchema),
  headcountRequirements: z.array(headcountSchema),
  workRule: workRuleSchema,
  // Added after the initial export format shipped — optional so backups
  // made before the Gantt feature existed still import cleanly.
  workTasks: z.array(workTaskSchema).optional().default([]),
  taskSegments: z.array(taskSegmentSchema).optional().default([]),
});

export function parseAppState(json: unknown): AppState {
  return appStateSchema.parse(json) as AppState;
}

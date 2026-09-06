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
});

export function parseAppState(json: unknown): AppState {
  return appStateSchema.parse(json) as AppState;
}

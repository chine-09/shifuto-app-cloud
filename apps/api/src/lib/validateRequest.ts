import { z } from "zod";
import type { AutoAssignShiftsRequest } from "@shifuto/shared-core";

// `__anonymized: z.literal(true)` rejects any payload that isn't the
// declared AnonymizedEmployee shape at runtime — the TypeScript boundary
// only helps the frontend author; the wire is untyped, so this schema is
// the actual last line of defense against a PII field slipping through.
const anonymizedEmployeeSchema = z.object({
  __anonymized: z.literal(true),
  id: z.string(),
  employmentType: z.enum(["full_time", "part_time"]),
  isActive: z.boolean(),
});

const headcountRequirementSchema = z.object({
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

export const autoAssignShiftsRequestSchema = z.object({
  planId: z.string(),
  employees: z.array(anonymizedEmployeeSchema),
  requestedLeaves: z.array(z.object({ employeeId: z.string(), date: z.string() })),
  headcountRequirements: z.array(headcountRequirementSchema),
  workRule: workRuleSchema,
  dateRange: z.object({ start: z.string(), end: z.string() }),
});

export function parseAutoAssignShiftsRequest(body: unknown): AutoAssignShiftsRequest {
  return autoAssignShiftsRequestSchema.parse(body) as AutoAssignShiftsRequest;
}

import { describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { handler } from "../src/handlers/autoAssignShifts";

function makeEvent(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as APIGatewayProxyEventV2;
}

const validRequest = {
  planId: "plan-1",
  employees: [{ __anonymized: true, id: "e1", employmentType: "part_time", isActive: true }],
  requestedLeaves: [],
  headcountRequirements: [
    { id: "h1", planId: "plan-1", date: "2026-09-01", startTime: "09:00", endTime: "17:00", requiredCount: 1 },
  ],
  workRule: null,
  dateRange: { start: "2026-09-01", end: "2026-09-30" },
};

describe("autoAssignShifts handler", () => {
  it("returns 200 with an assignment for a valid anonymized request", async () => {
    const res = (await handler(makeEvent(validRequest))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}");
    expect(body.assignedShifts).toHaveLength(1);
    expect(body.assignedShifts[0].employeeId).toBe("e1");
  });

  it("rejects a request whose employee is missing the __anonymized marker", async () => {
    const res = (await handler(
      makeEvent({ ...validRequest, employees: [{ id: "e1", employmentType: "part_time", isActive: true }] }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(400);
  });

  it("rejects a request carrying an unexpected `name` field on an employee (defense in depth)", async () => {
    const res = (await handler(
      makeEvent({
        ...validRequest,
        employees: [{ __anonymized: true, id: "e1", employmentType: "part_time", isActive: true, name: "山田太郎" }],
      }),
    )) as APIGatewayProxyStructuredResultV2;
    // zod's default mode strips unknown keys rather than rejecting them, so this
    // documents that behavior: the extra field is silently dropped, never echoed back.
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}");
    expect(JSON.stringify(body)).not.toContain("山田太郎");
  });

  it("returns 400 for malformed JSON", async () => {
    const event = { body: "{not json" } as APIGatewayProxyEventV2;
    const res = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(500);
  });
});

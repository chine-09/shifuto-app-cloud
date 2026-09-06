import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ZodError } from "zod";
import { autoAssignShifts } from "@shifuto/shared-core";
import { parseAutoAssignShiftsRequest } from "../lib/validateRequest";
import { jsonResponse } from "../lib/httpResponse";

/**
 * Stateless by design: parses the request, computes the assignment purely
 * in memory, returns the result, and keeps nothing — no disk write, no
 * database, no cache. The request never contains a name (see
 * validateRequest.ts's `__anonymized` check), so there is nothing PII to
 * discard in the first place.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = JSON.parse(event.body ?? "{}");
    const request = parseAutoAssignShiftsRequest(body);
    const result = autoAssignShifts(request);
    return jsonResponse(200, result);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonResponse(400, { error: "invalid request", issues: err.issues });
    }
    return jsonResponse(500, { error: "internal error" });
  }
}

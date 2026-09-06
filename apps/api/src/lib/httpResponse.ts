import type { APIGatewayProxyResultV2 } from "aws-lambda";

/**
 * SAM's `Cors` property only configures the auto-generated OPTIONS mock
 * method — it does NOT add CORS headers to a Lambda proxy integration's own
 * responses. Without this, the preflight succeeds but the browser then
 * blocks the actual POST response for missing Access-Control-Allow-Origin,
 * surfacing to the app as an opaque "Failed to fetch".
 */
export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": process.env.ALLOWED_ORIGIN ?? "",
    },
    body: JSON.stringify(body),
  };
}

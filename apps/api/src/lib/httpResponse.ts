import type { APIGatewayProxyResultV2 } from "aws-lambda";

/**
 * Unlike the old REST API (SAM `Cors` property), API Gateway HTTP API's
 * `corsConfiguration` adds CORS headers to every response automatically —
 * including a Lambda proxy integration's own responses, not just the
 * auto-generated OPTIONS preflight. Do NOT also set
 * access-control-allow-origin here: HTTP API would then emit it twice,
 * which browsers reject as an invalid multi-value header.
 */
export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

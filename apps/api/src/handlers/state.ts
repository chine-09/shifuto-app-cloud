import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { jsonResponse } from "../lib/httpResponse";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME ?? "";
const STATE_SK = "STATE";
const ACCOUNT_SK = "ACCOUNT";

// 350KB: comfortably under DynamoDB's 400KB item limit, leaving headroom for
// the accountId/sk keys and attribute overhead.
const MAX_BODY_BYTES = 350 * 1024;

/**
 * Paid-tier cloud auto-save. The whole app state travels as one opaque JSON
 * blob — the same shape the free tier already produces via "保存(ファイル)"
 * export — so this endpoint is a drop-in replacement for that file, not a
 * new data model. `accountId` always comes from the verified JWT claim,
 * never from the request body, so one account can never read or overwrite
 * another's data.
 */
function accountIdFrom(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return event.requestContext.authorizer.jwt.claims.sub as string;
}

/**
 * Every logged-in account is "free" until the Stripe webhook writes an
 * ACCOUNT item with plan="paid" (see billing/stripeWebhook.ts) — a missing
 * item is not an error, just an account that hasn't subscribed yet.
 */
export async function getAccount(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const accountId = accountIdFrom(event);
  const result = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { accountId, sk: ACCOUNT_SK } }),
  );
  const plan = result.Item?.plan === "paid" ? "paid" : "free";
  return jsonResponse(200, { plan });
}

export async function getState(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const accountId = accountIdFrom(event);
  const result = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { accountId, sk: STATE_SK } }),
  );
  if (!result.Item) {
    return jsonResponse(404, { error: "no saved state" });
  }
  return jsonResponse(200, { state: result.Item.state, updatedAt: result.Item.updatedAt });
}

export async function putState(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const accountId = accountIdFrom(event);
  const rawBody = event.body ?? "";
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: "state too large" });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400, { error: "invalid JSON" });
  }
  if (typeof parsed !== "object" || parsed === null) {
    return jsonResponse(400, { error: "body must be a JSON object" });
  }

  const updatedAt = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { accountId, sk: STATE_SK, state: parsed, updatedAt },
    }),
  );
  return jsonResponse(200, { updatedAt });
}

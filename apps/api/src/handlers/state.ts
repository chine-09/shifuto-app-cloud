import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { jsonResponse } from "../lib/httpResponse";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME ?? "";
const ACCOUNT_SK = "ACCOUNT";

// 350KB per record: comfortably under DynamoDB's 400KB item limit. Splitting
// state into MASTER/MONTH#.../DAY#... records (see apps/web/src/lib/cloud/records.ts)
// keeps every individual item far below this anyway — it's a backstop, not
// an expected ceiling.
const MAX_RECORD_BYTES = 350 * 1024;
// DynamoDB caps a single transaction at 100 items; a whole month of
// auto-assigned shifts is at most ~31 DAY records plus MASTER/MONTH, so this
// is generous headroom, not a real-world limit.
const MAX_RECORDS_PER_WRITE = 90;

/**
 * Paid-tier cloud auto-save. State is normalized per account into DynamoDB
 * items keyed by `sk`: one "MASTER" record (employees, work rule, work task
 * master), one "MONTH#<planId>" record per shift plan (headcount, requested
 * leaves), and one "DAY#<date>" record per date that has assigned
 * shifts/task segments — see apps/web/src/lib/cloud/records.ts for the
 * client-side (de)serialization to/from the app's single in-memory
 * AppState. `accountId` always comes from the verified JWT claim, never the
 * request body, so one account can never read or overwrite another's data.
 */
function accountIdFrom(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return event.requestContext.authorizer.jwt.claims.sub as string;
}

async function queryAccountRecords(accountId: string): Promise<{ sk: string; data: unknown; updatedAt: string }[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "accountId = :a",
      ExpressionAttributeValues: { ":a": accountId },
    }),
  );
  return (result.Items ?? [])
    .filter((item) => item.sk !== ACCOUNT_SK)
    .map((item) => ({ sk: item.sk as string, data: item.data, updatedAt: item.updatedAt as string }));
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
  const records = await queryAccountRecords(accountId);
  return jsonResponse(200, { records });
}

type IncomingRecord = { sk: string; data: unknown; baseUpdatedAt: string | null };

/**
 * Optimistic-concurrency guard against silent overwrites when the same
 * account is open on two devices/tabs, applied per record: each incoming
 * record carries the `updatedAt` the client last saw for that specific sk,
 * and the whole write is atomic (TransactWriteItems) — if any one record's
 * condition fails (someone else saved a newer version of just that record
 * in between), the entire batch is rejected together rather than partially
 * applied. A missing baseUpdatedAt means "I've never fetched this record",
 * which is only valid if nothing has been saved for it yet
 * (attribute_not_exists) — if it has, that's exactly the same conflict.
 *
 * On conflict, responds with the account's full current record set (one
 * Query) rather than trying to pinpoint just the losing record(s) — the
 * client's conflict UI resolves at whole-snapshot granularity (overwrite
 * everything with local, or discard local and reload everything), so this
 * keeps both sides of the contract simple.
 */
export async function putState(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const accountId = accountIdFrom(event);
  const rawBody = event.body ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400, { error: "invalid JSON" });
  }
  if (typeof parsed !== "object" || parsed === null) {
    return jsonResponse(400, { error: "body must be a JSON object" });
  }
  const { records } = parsed as { records?: IncomingRecord[] };
  if (!Array.isArray(records) || records.length === 0) {
    return jsonResponse(400, { error: "body.records must be a non-empty array" });
  }
  if (records.length > MAX_RECORDS_PER_WRITE) {
    return jsonResponse(413, { error: `too many records in one write (max ${MAX_RECORDS_PER_WRITE})` });
  }
  for (const r of records) {
    if (typeof r.sk !== "string" || r.sk === ACCOUNT_SK || typeof r.data !== "object" || r.data === null) {
      return jsonResponse(400, { error: `invalid record: ${JSON.stringify(r.sk)}` });
    }
    if (Buffer.byteLength(JSON.stringify(r.data), "utf8") > MAX_RECORD_BYTES) {
      return jsonResponse(413, { error: `record too large: ${r.sk}` });
    }
  }

  const updatedAt = new Date().toISOString();
  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: records.map((r) => ({
          Put: {
            TableName: TABLE_NAME,
            Item: { accountId, sk: r.sk, data: r.data, updatedAt },
            ConditionExpression: r.baseUpdatedAt ? "updatedAt = :base" : "attribute_not_exists(accountId)",
            ExpressionAttributeValues: r.baseUpdatedAt ? { ":base": r.baseUpdatedAt } : undefined,
          },
        })),
      }),
    );
  } catch (err) {
    if (err instanceof TransactionCanceledException) {
      const currentRecords = await queryAccountRecords(accountId);
      return jsonResponse(409, { error: "conflict", records: currentRecords });
    }
    throw err;
  }
  return jsonResponse(200, { updatedAt });
}

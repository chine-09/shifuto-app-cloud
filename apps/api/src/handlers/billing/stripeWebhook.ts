import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import Stripe from "stripe";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getSsmSecureString } from "../../lib/ssmParams";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME ?? "";
const ACCOUNT_SK = "ACCOUNT";

let stripeClient: Stripe | undefined;
async function getStripeClient(): Promise<Stripe> {
  if (!stripeClient) {
    const secretKey = await getSsmSecureString(process.env.STRIPE_SECRET_PARAM ?? "");
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

async function setPlanByAccountId(accountId: string, plan: "paid" | "free", stripeCustomerId?: string) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { accountId, sk: ACCOUNT_SK, plan, stripeCustomerId, updatedAt: new Date().toISOString() },
    }),
  );
}

async function setPlanByStripeCustomerId(stripeCustomerId: string, plan: "paid" | "free") {
  const found = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "byStripeCustomerId",
      KeyConditionExpression: "stripeCustomerId = :c",
      ExpressionAttributeValues: { ":c": stripeCustomerId },
      Limit: 1,
    }),
  );
  const accountId = found.Items?.[0]?.accountId as string | undefined;
  if (!accountId) {
    console.warn(`no account found for stripeCustomerId=${stripeCustomerId}`);
    return;
  }
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { accountId, sk: ACCOUNT_SK },
      UpdateExpression: "SET plan = :p, updatedAt = :u",
      ExpressionAttributeValues: { ":p": plan, ":u": new Date().toISOString() },
    }),
  );
}

/**
 * Public endpoint (no Cognito authorizer) — Stripe calls this directly, so
 * authenticity rests entirely on verifying the `stripe-signature` header
 * against the raw body. Never trust the parsed event body until this passes.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const signature = event.headers["stripe-signature"] ?? event.headers["Stripe-Signature"];
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body ?? "", "base64").toString("utf8") : (event.body ?? "");

  if (!signature) {
    return { statusCode: 400, body: "missing stripe-signature header" };
  }

  let stripeEvent: Stripe.Event;
  try {
    const stripe = await getStripeClient();
    const webhookSecret = await getSsmSecureString(process.env.STRIPE_WEBHOOK_SECRET_PARAM ?? "");
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("stripe signature verification failed", err);
    return { statusCode: 400, body: "invalid signature" };
  }

  switch (stripeEvent.type) {
    case "checkout.session.completed": {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const accountId = session.client_reference_id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (accountId && customerId) {
        await setPlanByAccountId(accountId, "paid", customerId);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = stripeEvent.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      await setPlanByStripeCustomerId(customerId, "free");
      break;
    }
    case "customer.subscription.updated": {
      const subscription = stripeEvent.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const stillActive = subscription.status === "active" || subscription.status === "trialing";
      await setPlanByStripeCustomerId(customerId, stillActive ? "paid" : "free");
      break;
    }
    default:
      break; // ignore events we don't act on
  }

  return { statusCode: 200, body: "ok" };
}

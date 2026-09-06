import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import Stripe from "stripe";
import { getSsmSecureString, getSsmString } from "../../lib/ssmParams";
import { jsonResponse } from "../../lib/httpResponse";

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "";

let stripeClient: Stripe | undefined;
async function getStripeClient(): Promise<Stripe> {
  if (!stripeClient) {
    const secretKey = await getSsmSecureString(process.env.STRIPE_SECRET_PARAM ?? "");
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

/**
 * Starts a Stripe-hosted Checkout session for the currently logged-in
 * account. Card details never touch this Lambda — Stripe Checkout collects
 * them on Stripe's own PCI-compliant page. `client_reference_id` carries our
 * Cognito `sub` so the webhook can attribute the resulting subscription to
 * the right account without us storing any card data ourselves.
 */
export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const claims = event.requestContext.authorizer.jwt.claims;
  const accountId = claims.sub as string;
  const email = claims.email as string | undefined;

  try {
    const stripe = await getStripeClient();
    const priceId = await getSsmString(process.env.STRIPE_PRICE_ID_PARAM ?? "");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: accountId,
      customer_email: email,
      success_url: `${WEB_ORIGIN}/billing/success`,
      cancel_url: `${WEB_ORIGIN}/billing/cancel`,
    });

    return jsonResponse(200, { url: session.url });
  } catch (err) {
    console.error("createCheckoutSession failed", err);
    return jsonResponse(500, { error: "failed to start checkout" });
  }
}

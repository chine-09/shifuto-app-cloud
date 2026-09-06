import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
const cache = new Map<string, string>();

async function getParam(name: string, withDecryption: boolean): Promise<string> {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const result = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: withDecryption }));
  const value = result.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter ${name} has no value`);

  cache.set(name, value);
  return value;
}

/** Fetches a SecureString parameter (e.g. a Stripe secret key), decrypted, with per-invocation-container caching. */
export function getSsmSecureString(name: string): Promise<string> {
  return getParam(name, true);
}

/** Fetches a plain String parameter (e.g. a Stripe price id). */
export function getSsmString(name: string): Promise<string> {
  return getParam(name, false);
}

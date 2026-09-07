import type { Plan } from "../../state/AuthContext";
import type { CloudRecord } from "../cloud/records";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

function authHeaders(idToken: string): HeadersInit {
  return { authorization: `Bearer ${idToken}` };
}

export async function fetchAccountPlan(idToken: string): Promise<Plan> {
  const res = await fetch(`${API_BASE_URL}/account`, { headers: authHeaders(idToken) });
  if (!res.ok) throw new Error(`GET /account failed: ${res.status}`);
  const body = (await res.json()) as { plan: Plan };
  return body.plan;
}

export type StoredRecord = CloudRecord & { updatedAt: string };

/** The account's full normalized record set (MASTER/MONTH#.../DAY#...) — empty if nothing has ever been saved. */
export async function fetchCloudState(idToken: string): Promise<{ records: StoredRecord[] }> {
  const res = await fetch(`${API_BASE_URL}/state`, { headers: authHeaders(idToken) });
  if (!res.ok) throw new Error(`GET /state failed: ${res.status}`);
  return res.json();
}

/**
 * Thrown when the server rejects a save because someone else (another tab
 * or device on the same account) saved a newer version of at least one
 * record in the batch in between — `records` is the account's full current
 * record set at the time of the conflict, needed both to show what's
 * actually different and to force an overwrite deliberately (see
 * useCloudSync's overwriteCloudWithLocal).
 */
export class SaveConflictError extends Error {
  readonly records: StoredRecord[];

  constructor(records: StoredRecord[]) {
    super("cloud save conflict: a newer version exists for at least one record");
    this.records = records;
  }
}

export type OutgoingRecord = CloudRecord & { baseUpdatedAt: string | null };

/** Atomically writes only the given (changed) records — see putState's TransactWriteItems in apps/api. */
export async function saveCloudState(idToken: string, records: OutgoingRecord[]): Promise<{ updatedAt: string }> {
  const res = await fetch(`${API_BASE_URL}/state`, {
    method: "PUT",
    headers: { ...authHeaders(idToken), "content-type": "application/json" },
    body: JSON.stringify({ records }),
  });
  if (res.status === 409) {
    const body = (await res.json()) as { records: StoredRecord[] };
    throw new SaveConflictError(body.records);
  }
  if (!res.ok) throw new Error(`PUT /state failed: ${res.status}`);
  return res.json();
}

export async function createCheckoutSession(idToken: string): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE_URL}/billing/create-checkout-session`, {
    method: "POST",
    headers: authHeaders(idToken),
  });
  if (!res.ok) throw new Error(`create-checkout-session failed: ${res.status}`);
  return res.json();
}

import type { Plan } from "../../state/AuthContext";

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

/** Returns null when the account has never saved to the cloud yet (404). */
export async function fetchCloudState(idToken: string): Promise<{ state: unknown; updatedAt: string } | null> {
  const res = await fetch(`${API_BASE_URL}/state`, { headers: authHeaders(idToken) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /state failed: ${res.status}`);
  return res.json();
}

export async function saveCloudState(idToken: string, state: unknown): Promise<{ updatedAt: string }> {
  const res = await fetch(`${API_BASE_URL}/state`, {
    method: "PUT",
    headers: { ...authHeaders(idToken), "content-type": "application/json" },
    body: JSON.stringify(state),
  });
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

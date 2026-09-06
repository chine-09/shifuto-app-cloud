import type { AutoAssignShiftsRequest, AutoAssignShiftsResponse } from "@shifuto/shared-core";

/**
 * The only place the app talks to Lambda. `req`'s type (AutoAssignShiftsRequest)
 * only accepts AnonymizedEmployee, so a PiiEmployee cannot be passed here without
 * first going through lib/anonymize.ts — the compiler enforces the boundary.
 *
 * The API key ships inside the SPA bundle, so it is not a secret: it only
 * deters casual scraping of the endpoint, backed by the API Gateway usage
 * plan's rate limit. It is not a substitute for authentication.
 */
export async function autoAssignShifts(req: AutoAssignShiftsRequest): Promise<AutoAssignShiftsResponse> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_API_BASE_URL が設定されていません。Lambda連携にはAPIのURLが必要です。");
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/auto-assign`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(import.meta.env.VITE_API_KEY ? { "x-api-key": import.meta.env.VITE_API_KEY } : {}),
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`自動割当の計算に失敗しました (${res.status}) ${text}`.trim());
  }

  return res.json();
}

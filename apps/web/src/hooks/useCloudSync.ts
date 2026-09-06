import { useEffect, useRef, useState } from "react";
import { useAuth } from "../state/AuthContext";
import { useAppDispatch, useAppState } from "../state/AppStateContext";
import { fetchCloudState, saveCloudState } from "../lib/api/cloudStateClient";
import type { AppState } from "../state/types";

const AUTO_SAVE_DEBOUNCE_MS = 3000;

export type CloudSyncStatus = "idle" | "saving" | "saved" | "error";

/**
 * Paid-tier auto-save: debounces state changes and PUTs the whole AppState
 * blob to /state, then reuses MARK_SAVED — the same action "保存(ファイル)"
 * dispatches — so the beforeunload guard and "未保存の変更があります" banner
 * treat a cloud save exactly like a file save. Free-tier (signed-out) users
 * never call this; the effect below is a no-op unless plan === "paid".
 */
export function useCloudSync(): { status: CloudSyncStatus; loadFromCloud: () => Promise<AppState | null> } {
  const { auth } = useAuth();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<CloudSyncStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (auth.status !== "signed-in" || auth.plan !== "paid" || !state.meta.isDirty) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await saveCloudState(auth.idToken, state);
        dispatch({ type: "MARK_SAVED" });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, auth.status === "signed-in" ? auth.idToken : null, auth.status === "signed-in" ? auth.plan : null, state]);

  async function loadFromCloud(): Promise<AppState | null> {
    if (auth.status !== "signed-in") return null;
    const result = await fetchCloudState(auth.idToken);
    return (result?.state as AppState) ?? null;
  }

  return { status, loadFromCloud };
}

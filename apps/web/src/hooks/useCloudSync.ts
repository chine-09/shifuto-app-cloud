import { useEffect, useRef, useState } from "react";
import { useAuth } from "../state/AuthContext";
import { useAppDispatch, useAppState } from "../state/AppStateContext";
import { fetchCloudState, saveCloudState, SaveConflictError } from "../lib/api/cloudStateClient";
import type { AppState } from "../state/types";

const AUTO_SAVE_DEBOUNCE_MS = 3000;

export type CloudSyncStatus = "idle" | "saving" | "saved" | "error" | "conflict";

/**
 * Paid-tier auto-save: debounces state changes and PUTs the whole AppState
 * blob to /state, then reuses MARK_SAVED — the same action "保存(ファイル)"
 * dispatches — so the beforeunload guard and "未保存の変更があります" banner
 * treat a cloud save exactly like a file save. Free-tier (signed-out) users
 * never call this; the effect below is a no-op unless plan === "paid".
 *
 * Optimistic concurrency: `baseUpdatedAtRef` tracks the `updatedAt` this tab
 * last saw (from its last successful GET or PUT). If another tab/device on
 * the same account saved a newer version in between, the server rejects the
 * write with 409 (see apps/api/src/handlers/state.ts) and this surfaces as
 * status "conflict" — the auto-save loop stops retrying (it would just keep
 * hitting the same conflict) until the user resolves it via
 * overwriteCloudWithLocal or discardLocalAndUseCloud.
 */
export function useCloudSyncEngine(): {
  status: CloudSyncStatus;
  conflictUpdatedAt: string | null;
  loadFromCloud: () => Promise<AppState | null>;
  overwriteCloudWithLocal: () => Promise<void>;
  discardLocalAndUseCloud: () => Promise<void>;
} {
  const { auth } = useAuth();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<CloudSyncStatus>("idle");
  const [conflictUpdatedAt, setConflictUpdatedAt] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseUpdatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (auth.status !== "signed-in" || auth.plan !== "paid" || !state.meta.isDirty || status === "conflict") return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        const { updatedAt } = await saveCloudState(auth.idToken, state, baseUpdatedAtRef.current);
        baseUpdatedAtRef.current = updatedAt;
        dispatch({ type: "MARK_SAVED" });
        setStatus("saved");
      } catch (err) {
        if (err instanceof SaveConflictError) {
          setConflictUpdatedAt(err.currentUpdatedAt);
          setStatus("conflict");
        } else {
          setStatus("error");
        }
      }
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, auth.status === "signed-in" ? auth.idToken : null, auth.status === "signed-in" ? auth.plan : null, state, status]);

  async function loadFromCloud(): Promise<AppState | null> {
    if (auth.status !== "signed-in") return null;
    const result = await fetchCloudState(auth.idToken);
    if (result) baseUpdatedAtRef.current = result.updatedAt;
    return (result?.state as AppState) ?? null;
  }

  /** Resolve a conflict by discarding this tab's local changes and loading the newer cloud version. */
  async function discardLocalAndUseCloud(): Promise<void> {
    const cloudState = await loadFromCloud();
    if (cloudState) dispatch({ type: "IMPORT_STATE", state: cloudState });
    setStatus("idle");
    setConflictUpdatedAt(null);
  }

  /** Resolve a conflict by force-saving this tab's local state over the newer cloud version. */
  async function overwriteCloudWithLocal(): Promise<void> {
    if (auth.status !== "signed-in") return;
    setStatus("saving");
    try {
      const { updatedAt } = await saveCloudState(auth.idToken, state, conflictUpdatedAt);
      baseUpdatedAtRef.current = updatedAt;
      dispatch({ type: "MARK_SAVED" });
      setStatus("saved");
      setConflictUpdatedAt(null);
    } catch (err) {
      if (err instanceof SaveConflictError) {
        // Yet another save landed in the meantime — stay in conflict with the latest timestamp.
        setConflictUpdatedAt(err.currentUpdatedAt);
        setStatus("conflict");
      } else {
        setStatus("error");
      }
    }
  }

  return { status, conflictUpdatedAt, loadFromCloud, overwriteCloudWithLocal, discardLocalAndUseCloud };
}

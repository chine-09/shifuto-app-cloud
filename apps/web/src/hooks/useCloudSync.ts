import { useEffect, useRef, useState } from "react";
import { useAuth } from "../state/AuthContext";
import { useAppDispatch, useAppState } from "../state/AppStateContext";
import { fetchCloudState, saveCloudState, SaveConflictError, type StoredRecord, type OutgoingRecord } from "../lib/api/cloudStateClient";
import { toRecords, fromRecords } from "../lib/cloud/records";
import type { AppState } from "../state/types";

const AUTO_SAVE_DEBOUNCE_MS = 3000;

export type CloudSyncStatus = "idle" | "saving" | "saved" | "error" | "conflict";

type SyncedEntry = { dataJson: string; updatedAt: string };

/**
 * Paid-tier auto-save: debounces state changes, splits AppState into
 * normalized records (see lib/cloud/records.ts), and PUTs only the ones
 * that actually changed since the last successful sync — then reuses
 * MARK_SAVED, the same action "保存(ファイル)" dispatches, so the
 * beforeunload guard and "未保存の変更があります" banner treat a cloud save
 * exactly like a file save. Free-tier (signed-out) users never call this;
 * the effect below is a no-op unless plan === "paid".
 *
 * `syncedRef` tracks, per record key (sk), the JSON of the data this tab
 * last confirmed synced and the `updatedAt` the server assigned it — the
 * former drives the diff (what's actually dirty), the latter is sent back
 * as each record's `baseUpdatedAt` for the server's per-record
 * optimistic-concurrency check. If another tab/device on the same account
 * saved a newer version of any record in the batch, the whole batch is
 * rejected together (409) and this surfaces as status "conflict" — the
 * auto-save loop stops retrying (it would just keep hitting the same
 * conflict) until the user resolves it via overwriteCloudWithLocal or
 * discardLocalAndUseCloud.
 */
export function useCloudSyncEngine(): {
  status: CloudSyncStatus;
  lastSavedAt: string | null;
  conflictUpdatedAt: string | null;
  loadFromCloud: () => Promise<AppState | null>;
  overwriteCloudWithLocal: () => Promise<void>;
  discardLocalAndUseCloud: () => Promise<void>;
  restoreFromFile: (imported: AppState) => Promise<void>;
} {
  const { auth } = useAuth();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<CloudSyncStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [conflictRecords, setConflictRecords] = useState<StoredRecord[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedRef = useRef<Map<string, SyncedEntry>>(new Map());

  function recordSynced(records: { sk: string; data: unknown }[], updatedAt: string) {
    for (const r of records) syncedRef.current.set(r.sk, { dataJson: JSON.stringify(r.data), updatedAt });
  }

  /** Every record for `full`, tagged with each one's last-known baseUpdatedAt, plus explicit empty overwrites for DAY records that no longer have any data (so a cleared day doesn't resurrect on the next load). Used to force-push a whole state (conflict resolution, restoring from a file) regardless of the dirty-diff tracked by computeChangedRecords. */
  function outgoingRecordsForFullState(full: AppState, baseUpdatedAtBySk?: Map<string, string>): OutgoingRecord[] {
    const currentRecords = toRecords(full);
    const currentKeys = new Set(currentRecords.map((r) => r.sk));
    const records: OutgoingRecord[] = currentRecords.map((r) => ({
      sk: r.sk,
      data: r.data,
      baseUpdatedAt: baseUpdatedAtBySk?.get(r.sk) ?? syncedRef.current.get(r.sk)?.updatedAt ?? null,
    }));

    for (const [sk, tracked] of syncedRef.current) {
      if (sk.startsWith("DAY#") && !currentKeys.has(sk)) {
        records.push({ sk, data: { assignedShifts: [], taskSegments: [] }, baseUpdatedAt: tracked.updatedAt });
      }
    }

    return records;
  }

  /** Records that differ from what's last confirmed synced, plus explicit empty overwrites for DAY records that no longer have any data (so a cleared day doesn't resurrect on the next load). */
  function computeChangedRecords(current: AppState): OutgoingRecord[] {
    const currentRecords = toRecords(current);
    const currentKeys = new Set(currentRecords.map((r) => r.sk));
    const changed: OutgoingRecord[] = [];

    for (const r of currentRecords) {
      const dataJson = JSON.stringify(r.data);
      const tracked = syncedRef.current.get(r.sk);
      if (!tracked || tracked.dataJson !== dataJson) {
        changed.push({ sk: r.sk, data: r.data, baseUpdatedAt: tracked?.updatedAt ?? null });
      }
    }

    for (const [sk, tracked] of syncedRef.current) {
      if (sk.startsWith("DAY#") && !currentKeys.has(sk)) {
        changed.push({ sk, data: { assignedShifts: [], taskSegments: [] }, baseUpdatedAt: tracked.updatedAt });
      }
    }

    return changed;
  }

  useEffect(() => {
    if (auth.status !== "signed-in" || auth.plan !== "paid" || !state.meta.isDirty || status === "conflict") return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const changed = computeChangedRecords(state);
      if (changed.length === 0) {
        // isDirty but nothing cloud-relevant actually differs (e.g. an undo
        // that landed back on the last-synced content) — nothing to send.
        dispatch({ type: "MARK_SAVED" });
        return;
      }

      setStatus("saving");
      try {
        const { updatedAt } = await saveCloudState(auth.idToken, changed);
        recordSynced(changed, updatedAt);
        dispatch({ type: "MARK_SAVED" });
        setStatus("saved");
        setLastSavedAt(updatedAt);
      } catch (err) {
        if (err instanceof SaveConflictError) {
          setConflictRecords(err.records);
          setStatus("conflict");
        } else {
          setStatus("error");
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, auth.status === "signed-in" ? auth.idToken : null, auth.status === "signed-in" ? auth.plan : null, state, status]);

  async function loadFromCloud(): Promise<AppState | null> {
    if (auth.status !== "signed-in") return null;
    const { records } = await fetchCloudState(auth.idToken);
    if (records.length === 0) return null;
    syncedRef.current = new Map(records.map((r) => [r.sk, { dataJson: JSON.stringify(r.data), updatedAt: r.updatedAt }]));
    return fromRecords(records);
  }

  /** Resolve a conflict by discarding this tab's local changes and loading the newer cloud version. */
  async function discardLocalAndUseCloud(): Promise<void> {
    const cloudState = await loadFromCloud();
    if (cloudState) dispatch({ type: "IMPORT_STATE", state: cloudState });
    setStatus("idle");
    setConflictRecords(null);
  }

  /**
   * Resolve a conflict by force-saving this tab's version of every record
   * it currently has over the cloud's — using the fresher `updatedAt`
   * values from the conflict report so the write actually succeeds this
   * time. Note this only overwrites records this device has; a record the
   * *other* device created that this device never had locally (e.g. a plan
   * only ever opened there) is left untouched in the cloud rather than
   * deleted — full-conflict resolution here favors "don't destroy data
   * neither side is looking at" over a perfectly clean overwrite.
   */
  async function overwriteCloudWithLocal(): Promise<void> {
    if (auth.status !== "signed-in") return;
    setStatus("saving");
    const conflictUpdatedAtBySk = new Map((conflictRecords ?? []).map((r) => [r.sk, r.updatedAt]));
    const all = outgoingRecordsForFullState(state, conflictUpdatedAtBySk);
    try {
      const { updatedAt } = await saveCloudState(auth.idToken, all);
      recordSynced(all, updatedAt);
      dispatch({ type: "MARK_SAVED" });
      setStatus("saved");
      setLastSavedAt(updatedAt);
      setConflictRecords(null);
    } catch (err) {
      if (err instanceof SaveConflictError) {
        // Yet another save landed in the meantime — stay in conflict with the latest report.
        setConflictRecords(err.records);
        setStatus("conflict");
      } else {
        setStatus("error");
      }
    }
  }

  /**
   * Restoring a JSON backup (e.g. right after upgrading from the free tier,
   * or recovering from a mistake) replaces the whole state and — unlike a
   * normal edit — IMPORT_STATE marks it clean (`isDirty: false`), so the
   * debounced auto-save effect would never notice it needs pushing. Force a
   * push of every record immediately, then apply the imported state once the
   * cloud copy is confirmed current.
   */
  async function restoreFromFile(imported: AppState): Promise<void> {
    if (auth.status !== "signed-in") {
      dispatch({ type: "IMPORT_STATE", state: imported });
      return;
    }
    setStatus("saving");
    const all = outgoingRecordsForFullState(imported);
    try {
      const { updatedAt } = await saveCloudState(auth.idToken, all);
      recordSynced(all, updatedAt);
      setStatus("saved");
      setLastSavedAt(updatedAt);
      setConflictRecords(null);
      dispatch({ type: "IMPORT_STATE", state: imported });
    } catch (err) {
      if (err instanceof SaveConflictError) {
        setConflictRecords(err.records);
        setStatus("conflict");
      } else {
        setStatus("error");
      }
      throw err;
    }
  }

  const conflictUpdatedAt =
    conflictRecords && conflictRecords.length > 0
      ? conflictRecords.reduce((latest, r) => (r.updatedAt > latest ? r.updatedAt : latest), conflictRecords[0].updatedAt)
      : null;

  return { status, lastSavedAt, conflictUpdatedAt, loadFromCloud, overwriteCloudWithLocal, discardLocalAndUseCloud, restoreFromFile };
}

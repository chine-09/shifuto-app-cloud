import { createContext, useContext, type ReactNode } from "react";
import { useCloudSyncEngine } from "../hooks/useCloudSync";

type CloudSyncContextValue = ReturnType<typeof useCloudSyncEngine>;

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

/**
 * Runs the auto-save debounce loop exactly once for the whole app. Both
 * App.tsx (which just needs the side effect running) and AccountPage.tsx
 * (which displays status and offers conflict resolution) read from this one
 * instance — calling useCloudSyncEngine() directly in two places would spin
 * up two independent debounce loops and two independent `baseUpdatedAt`
 * trackers, which would defeat the optimistic-concurrency check entirely.
 */
export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const value = useCloudSyncEngine();
  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}

export function useCloudSync(): CloudSyncContextValue {
  const ctx = useContext(CloudSyncContext);
  if (!ctx) throw new Error("useCloudSync must be used within CloudSyncProvider");
  return ctx;
}

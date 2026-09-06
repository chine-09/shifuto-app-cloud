import { useEffect, useRef, useState } from "react";

/**
 * Warns the user before closing/reloading the tab while there are unsaved
 * changes, and also surfaces `showSaveReminder` for an in-app nudge toward
 * "保存(JSON)" once the user dismisses that browser dialog and stays.
 *
 * There is no native event for "the user clicked Cancel" — the browser
 * blocks JS while its dialog is open, so we start a short timeout right as
 * beforeunload fires. If the user leaves, the page unloads (or `pagehide`
 * fires) before the timeout runs; if they cancel, execution resumes and the
 * timeout fires, which is our only signal that they chose to stay.
 */
export function useBeforeUnloadGuard(isDirty: boolean) {
  const [showSaveReminder, setShowSaveReminder] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
      timeoutRef.current = window.setTimeout(() => setShowSaveReminder(true), 300);
    }
    function handlePageHide() {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    };
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) setShowSaveReminder(false);
  }, [isDirty]);

  return { showSaveReminder, dismissSaveReminder: () => setShowSaveReminder(false) };
}

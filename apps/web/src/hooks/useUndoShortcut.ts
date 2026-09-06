import { useEffect } from "react";
import type { Dispatch } from "react";
import type { AppAction } from "../state/types";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Cmd/Ctrl+Z triggers UNDO, except while focus is in an editable field (so
 * native text-undo inside inputs/textareas keeps working as expected). */
export function useUndoShortcut(dispatch: Dispatch<AppAction>) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "z" || (!e.metaKey && !e.ctrlKey) || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable)) return;
      e.preventDefault();
      dispatch({ type: "UNDO" });
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);
}

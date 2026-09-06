import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { appReducer } from "./appReducer";
import { createInitialState, type AppAction, type AppState } from "./types";

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<AppAction> | null>(null);
const CanUndoContext = createContext<boolean>(false);

/** How many past states "元に戻す" can step back through. */
const MAX_UNDO_HISTORY = 30;

export type History = { present: AppState; past: AppState[] };

/**
 * Wraps appReducer with a linear undo stack: every mutating action snapshots
 * the state it's about to replace, so "元に戻す" (e.g. after an accidental
 * bulk headcount set or auto-assign) can restore it. MARK_SAVED is excluded
 * — it only flips isDirty, so undoing "I just saved" would be a no-op the
 * user never asked for.
 */
export function historyReducer(history: History, action: AppAction): History {
  if (action.type === "UNDO") {
    if (history.past.length === 0) return history;
    const previous = history.past[history.past.length - 1];
    return { present: previous, past: history.past.slice(0, -1) };
  }

  const nextPresent = appReducer(history.present, action);
  if (action.type === "MARK_SAVED" || nextPresent === history.present) {
    return { ...history, present: nextPresent };
  }
  return { present: nextPresent, past: [...history.past, history.present].slice(-MAX_UNDO_HISTORY) };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [history, dispatch] = useReducer(historyReducer, undefined, () => ({
    present: createInitialState(),
    past: [],
  }));
  return (
    <StateContext.Provider value={history.present}>
      <DispatchContext.Provider value={dispatch}>
        <CanUndoContext.Provider value={history.past.length > 0}>{children}</CanUndoContext.Provider>
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const state = useContext(StateContext);
  if (!state) throw new Error("useAppState must be used within AppStateProvider");
  return state;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error("useAppDispatch must be used within AppStateProvider");
  return dispatch;
}

/** Whether there's a previous state "元に戻す" can restore. */
export function useCanUndo(): boolean {
  return useContext(CanUndoContext);
}

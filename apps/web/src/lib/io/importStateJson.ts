import { parseAppState } from "./stateSchema";
import type { AppState } from "../../state/types";

/**
 * Reads and validates a previously exported JSON file. Fails closed: on any
 * parse/validation error, throws without touching existing state.
 */
export async function importStateJson(file: File): Promise<AppState> {
  const text = await file.text();
  const json = JSON.parse(text);
  return parseAppState(json);
}

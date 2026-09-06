import type { AppState } from "../../state/types";

/**
 * Downloads the entire in-memory app state (including real employee names)
 * as a JSON file. This is the only persistence mechanism — no server, no
 * LocalStorage (a shared PC could leave a browsable trace there).
 */
export function exportStateJson(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .slice(0, 13); // YYYYMMDDTHHmm
  a.href = url;
  a.download = `shifuto_${state.meta.storeName || "data"}_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

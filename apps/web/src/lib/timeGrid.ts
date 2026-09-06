const SLOT_MINUTES = 15;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** "HH:mm" ticks from gridStart up to (not including) gridEnd, every 15 minutes. */
export function buildTimeTicks(gridStart: string, gridEnd: string): string[] {
  const startMin = toMinutes(gridStart);
  const endMin = toMinutes(gridEnd);
  const ticks: string[] = [];
  for (let m = startMin; m < endMin; m += SLOT_MINUTES) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    ticks.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return ticks;
}

/** 0-100 position of `time` within [gridStart, gridEnd], clamped to the range. */
export function percentWithinGrid(time: string, gridStart: string, gridEnd: string): number {
  const span = toMinutes(gridEnd) - toMinutes(gridStart);
  if (span <= 0) return 0;
  const offset = toMinutes(time) - toMinutes(gridStart);
  return Math.min(100, Math.max(0, (offset / span) * 100));
}

function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Inverse of percentWithinGrid: the "HH:mm" tick nearest `percent`, snapped to 15 minutes and clamped to the grid. */
export function timeAtPercent(percent: number, gridStart: string, gridEnd: string): string {
  const startMin = toMinutes(gridStart);
  const span = toMinutes(gridEnd) - startMin;
  const clamped = Math.min(100, Math.max(0, percent));
  const rawMinutes = startMin + (clamped / 100) * span;
  const snapped = Math.round(rawMinutes / SLOT_MINUTES) * SLOT_MINUTES;
  return toTimeString(Math.min(toMinutes(gridEnd), Math.max(startMin, snapped)));
}

export { SLOT_MINUTES };

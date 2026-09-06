import type { ShiftType } from "./types/shift";

/** No server round-trip computes this for us anymore, so the client derives it locally. */
export function computeShiftHours(
  shiftType: ShiftType,
  startTime: string | null,
  endTime: string | null,
): number {
  if (shiftType !== "work" || !startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

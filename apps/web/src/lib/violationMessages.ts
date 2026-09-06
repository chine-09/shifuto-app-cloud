import type { Violation, ViolationType } from "@shifuto/shared-core";

/**
 * Builds the human-readable message from a PII-free Violation plus the
 * employee's real name, resolved locally from in-memory state. This is
 * the only place violation text touches a name; checkViolations() itself
 * never sees one (see packages/shared-core/src/validation/checkViolations.ts).
 */
export function buildViolationMessage(v: Violation, employeeName: string | undefined): string {
  const name = employeeName ?? "従業員";
  switch (v.type) {
    case "unmet_leave_request":
      return `${name}さんは${v.date}に希望休を出していますが、勤務が割り当てられています。`;
    case "max_consecutive_days":
      return `${name}さんは${v.dates?.[0]}から${v.dates?.length}日連続勤務しており、上限を超えています。`;
    case "max_weekly_hours":
      return `${name}さんは${v.dates?.[0]}の週の勤務時間が上限を超えています。`;
    case "understaffed_slot":
      return `${v.date}は必要人数に対して割り当てが不足しています。`;
    default: {
      const _exhaustive: never = v.type;
      return _exhaustive;
    }
  }
}

export const VIOLATION_TYPE_LABELS: Record<ViolationType, string> = {
  unmet_leave_request: "希望休の未達成",
  max_consecutive_days: "連続勤務日数の超過",
  max_weekly_hours: "週間労働時間の超過",
  understaffed_slot: "人員不足",
};

import type { EmployeeId, PiiEmployee, Violation, ViolationType } from "@shifuto/shared-core";
import { buildViolationMessage, VIOLATION_TYPE_LABELS } from "../../lib/violationMessages";

const TYPE_ORDER: ViolationType[] = [
  "unmet_leave_request",
  "max_consecutive_days",
  "max_weekly_hours",
  "understaffed_slot",
];

export function cellElementId(employeeId: string, date: string) {
  return `shift-cell-${employeeId}-${date}`;
}

function scrollToCell(v: Violation) {
  if (!v.employeeId || !v.date) return;
  const el = document.getElementById(cellElementId(v.employeeId, v.date));
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  el.classList.add("ring-2", "ring-blue-500");
  setTimeout(() => el.classList.remove("ring-2", "ring-blue-500"), 1500);
}

export function ViolationsPanel({
  violations,
  employeesById,
}: {
  violations: Violation[];
  employeesById: Map<EmployeeId, PiiEmployee>;
}) {
  if (violations.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
        <span aria-hidden>✓</span>
        <span>問題は見つかりませんでした。</span>
      </div>
    );
  }

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: violations.filter((v) => v.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-3">
      <p className="text-sm font-semibold text-red-700">
        {violations.length}件の違反が見つかりました
      </p>
      {grouped.map((group) => (
        <div key={group.type}>
          <h4 className="mb-1 text-sm font-semibold text-zinc-700">
            {VIOLATION_TYPE_LABELS[group.type]}（{group.items.length}件）
          </h4>
          <ul className="flex flex-col gap-1">
            {group.items.map((v, i) => (
              <li key={`${group.type}-${i}`}>
                <button
                  type="button"
                  onClick={() => scrollToCell(v)}
                  className="w-full rounded px-2 py-1 text-left text-sm text-zinc-700 hover:bg-red-100"
                >
                  <span className="mr-1 text-red-500" aria-hidden>
                    ⚠
                  </span>
                  {buildViolationMessage(v, v.employeeId ? employeesById.get(v.employeeId)?.name : undefined)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

import type { AnonymizedEmployee, PiiEmployee } from "@shifuto/shared-core";

/**
 * The only function allowed to produce AnonymizedEmployee values. Uses an
 * explicit allowlist (not `Omit<PiiEmployee, "name">`) so a future PII field
 * added to PiiEmployee does not silently leak here — it has to be picked
 * on purpose. Never add `name` (or anything derived from it, like `role`,
 * which is free text employees could put a name in) to this list.
 */
export function anonymizeEmployee(employee: PiiEmployee): AnonymizedEmployee {
  return {
    __anonymized: true,
    id: employee.id,
    employmentType: employee.employmentType,
    isActive: employee.isActive,
  };
}

export function anonymizeEmployees(employees: PiiEmployee[]): AnonymizedEmployee[] {
  return employees.map(anonymizeEmployee);
}

import type { EmployeeId } from "./ids";
import type { EmploymentType } from "./pii";

/**
 * The `__anonymized` marker is a nominal brand: only anonymizeEmployee()
 * (apps/web/src/lib/anonymize.ts) may construct this type, so a PiiEmployee
 * can never be passed where an AnonymizedEmployee is expected.
 */
export type AnonymizedEmployee = {
  readonly __anonymized: true;
  id: EmployeeId;
  employmentType: EmploymentType;
  isActive: boolean;
};

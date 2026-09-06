import type { EmployeeId } from "./ids";

export type EmploymentType = "full_time" | "part_time";

/**
 * Contains the employee's real name. Must never be imported by apps/api
 * or by apps/web/src/lib/api/** (enforced via ESLint no-restricted-imports).
 */
export type PiiEmployee = {
  id: EmployeeId;
  name: string;
  role: string | null;
  employmentType: EmploymentType;
  isActive: boolean;
  sortOrder: number;
};

export type EmployeeId = string & { readonly __brand: "EmployeeId" };
export type PlanId = string & { readonly __brand: "PlanId" };

export function asEmployeeId(id: string): EmployeeId {
  return id as EmployeeId;
}

export function asPlanId(id: string): PlanId {
  return id as PlanId;
}

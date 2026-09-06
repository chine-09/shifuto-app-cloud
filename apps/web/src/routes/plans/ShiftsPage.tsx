import { ShiftTable } from "../../components/shift-table/ShiftTable";
import { usePlanContext } from "./usePlanContext";

export function ShiftsPage() {
  const { planId } = usePlanContext();
  return <ShiftTable planId={planId} />;
}

import { useRef } from "react";
import { asEmployeeId, type EmploymentType } from "@shifuto/shared-core";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useAppDispatch } from "../../state/AppStateContext";

export function CreateEmployeeForm({ nextSortOrder }: { nextSortOrder: number }) {
  const dispatch = useAppDispatch();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;

    dispatch({
      type: "UPSERT_EMPLOYEE",
      employee: {
        id: asEmployeeId(crypto.randomUUID()),
        name,
        role: String(form.get("role") ?? "").trim() || null,
        employmentType: form.get("employment_type") as EmploymentType,
        isActive: true,
        sortOrder: nextSortOrder,
      },
    });
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-zinc-500">
          氏名
          <Input type="text" name="name" required className="w-40" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-500">
          役割
          <Input type="text" name="role" placeholder="ホール等" className="w-32" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-500">
          雇用形態
          <select name="employment_type" defaultValue="part_time" className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-base">
            <option value="part_time">パート/アルバイト</option>
            <option value="full_time">正社員</option>
          </select>
        </label>
        <Button type="submit">追加</Button>
      </div>
    </form>
  );
}

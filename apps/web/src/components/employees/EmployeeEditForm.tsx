import type { EmploymentType, PiiEmployee } from "@shifuto/shared-core";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useAppDispatch } from "../../state/AppStateContext";

export function EmployeeEditForm({ employee }: { employee: PiiEmployee }) {
  const dispatch = useAppDispatch();

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    dispatch({
      type: "UPSERT_EMPLOYEE",
      employee: {
        ...employee,
        name: String(form.get("name") ?? "").trim() || employee.name,
        role: String(form.get("role") ?? "").trim() || null,
        employmentType: form.get("employment_type") as EmploymentType,
        isActive: form.get("is_active") === "on",
      },
    });
  }

  function handleDelete() {
    if (!confirm(`${employee.name}さんを削除します。よろしいですか？`)) return;
    dispatch({ type: "DELETE_EMPLOYEE", id: employee.id });
  }

  return (
    <>
      <form onSubmit={handleUpdate} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            氏名
            <Input type="text" name="name" defaultValue={employee.name} required className="w-40" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            役割
            <Input type="text" name="role" defaultValue={employee.role ?? ""} className="w-32" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            雇用形態
            <select name="employment_type" defaultValue={employee.employmentType} className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-base">
              <option value="part_time">パート/アルバイト</option>
              <option value="full_time">正社員</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 pb-1.5 text-sm text-zinc-500">
            <input type="checkbox" name="is_active" defaultChecked={employee.isActive} />
            在籍中にする
          </label>
          <Button type="submit">更新する</Button>
        </div>
      </form>

      <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="danger" className="w-fit" onClick={handleDelete}>
          この従業員を削除
        </Button>
      </div>
    </>
  );
}

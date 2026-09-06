import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CreateEmployeeForm } from "../components/employees/CreateEmployeeForm";
import { EmployeeEditForm } from "../components/employees/EmployeeEditForm";
import { Button } from "../components/ui/Button";
import { useAppDispatch, useAppState } from "../state/AppStateContext";
import { downloadEmployeesTemplate } from "../lib/import/excelTemplate";
import { importEmployeesXlsx } from "../lib/import/importEmployeesXlsx";

export function EmployeesPage() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const employees = [...state.employees].sort((a, b) => a.sortOrder - b.sortOrder);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);

  function handleDownloadTemplate() {
    void downloadEmployeesTemplate();
    setTemplateMessage("✓ ダウンロードフォルダに出力しました");
    setTimeout(() => setTemplateMessage(null), 4000);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportMessage(null);
    try {
      const { employees: imported, skippedRows } = await importEmployeesXlsx(file, employees.length);
      for (const employee of imported) {
        dispatch({ type: "UPSERT_EMPLOYEE", employee });
      }
      setImportMessage(
        `${imported.length}名を読み込みました。` + (skippedRows > 0 ? `（氏名未入力の行を${skippedRows}件スキップ）` : ""),
      );
    } catch {
      setImportMessage("Excelファイルの読み込みに失敗しました。テンプレートの形式を確認してください。");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold text-zinc-900">従業員</h1>
        <p className="mt-1 text-base text-zinc-500">シフト表に登場する従業員を登録します。</p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-zinc-700">新規登録</h2>
        <CreateEmployeeForm nextSortOrder={employees.length} />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-zinc-700">Excelから一括登録</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={handleDownloadTemplate}>
            テンプレートをダウンロード
          </Button>
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Excelから読み込む
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx" hidden onChange={handleImportFile} />
          {templateMessage && <span className="text-sm text-green-600">{templateMessage}</span>}
          {importMessage && <span className="text-sm text-zinc-600">{importMessage}</span>}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {employees.length === 0 ? (
          <p className="text-base text-zinc-500">まだ従業員が登録されていません。</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-600">登録が済んだら、次のステップに進めます。</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/settings"
                  className="whitespace-nowrap rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  ①（任意）勤務ルールを設定する
                </Link>
                <Link
                  to="/"
                  className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-base font-medium text-white transition-colors hover:bg-blue-700"
                >
                  ②TOPでシフト計画を開く
                </Link>
              </div>
            </div>
            {employees.map((employee) => (
              <div key={employee.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <EmployeeEditForm employee={employee} />
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}

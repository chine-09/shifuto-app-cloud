import { useRef, useState } from "react";
import { asEmployeeId, toDateKey, weekdayOf, WEEKDAY_LABELS_JA, type PiiEmployee, type PlanId } from "@shifuto/shared-core";
import { Button } from "../ui/Button";
import { useAppDispatch } from "../../state/AppStateContext";
import { downloadLeavesTemplate } from "../../lib/import/excelTemplate";
import { importLeavesXlsx } from "../../lib/import/importLeavesXlsx";

export function LeavesForm({
  planId,
  employees,
  dates,
  initialLeaveKeys,
}: {
  planId: PlanId;
  employees: PiiEmployee[];
  dates: Date[];
  /** `${employeeId}_${dateKey}` keys for currently requested leaves. */
  initialLeaveKeys: string[];
}) {
  const dispatch = useAppDispatch();
  const [checked, setChecked] = useState(() => new Set(initialLeaveKeys));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);

  function commit(next: Set<string>) {
    const leaves = [...next].map((key) => {
      const [employeeId, date] = key.split("_") as [string, string];
      return { employeeId: asEmployeeId(employeeId), planId, date };
    });
    dispatch({ type: "REPLACE_LEAVES_FOR_PLAN", planId, leaves });
  }

  function handleDownloadTemplate() {
    void downloadLeavesTemplate(employees);
    setTemplateMessage("✓ ダウンロードフォルダに出力しました");
    setTimeout(() => setTemplateMessage(null), 4000);
  }

  function toggle(key: string) {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChecked(next);
    commit(next);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportMessage(null);
    try {
      const { matched, unmatchedRows } = await importLeavesXlsx(file, employees);
      const next = new Set(checked);
      for (const { employeeId, date } of matched) next.add(`${employeeId}_${date}`);
      setChecked(next);
      commit(next);
      const parts = [`${matched.length}件を取り込んで反映しました。`];
      if (unmatchedRows.length > 0) {
        const names = [...new Set(unmatchedRows.map((r) => r.name))].join("、");
        parts.push(`未登録の氏名のためスキップ: ${names}`);
      }
      setImportMessage(parts.join(" "));
    } catch {
      setImportMessage("Excelファイルの読み込みに失敗しました。テンプレートの形式を確認してください。");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={handleDownloadTemplate}>
          テンプレートをダウンロード
        </Button>
        <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Excelから読み込む
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx" hidden onChange={handleImportFile} />
        {templateMessage && <span className="text-sm text-green-600">{templateMessage}</span>}
      </div>
      <p className="text-sm text-zinc-500">
        チェックを入れた日が、その従業員の希望休（休みたい日）になります。チェックすると自動的に反映されます（保存ボタンは不要です）。
      </p>
      {importMessage && <p className="text-sm text-zinc-600">{importMessage}</p>}
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[8rem] border border-zinc-200 bg-zinc-50 px-2 py-1 text-left">
                従業員
              </th>
              {dates.map((date) => {
                const wd = weekdayOf(date);
                const bg = wd === 6 ? "bg-blue-100" : wd === 0 ? "bg-pink-100" : "bg-zinc-50";
                return (
                  <th key={toDateKey(date)} className={`border border-zinc-200 px-1.5 py-1 text-center font-normal ${bg}`}>
                    {date.getDate()}
                    <br />
                    {WEEKDAY_LABELS_JA[wd]}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td
                  className="sticky left-0 z-10 max-w-[9rem] truncate overflow-hidden whitespace-nowrap border border-zinc-200 bg-white px-2 py-1 font-medium text-zinc-800"
                  title={employee.name}
                >
                  {employee.name}
                </td>
                {dates.map((date) => {
                  const dateKey = toDateKey(date);
                  const key = `${employee.id}_${dateKey}`;
                  const wd = weekdayOf(date);
                  const bg = wd === 6 ? "bg-blue-50" : wd === 0 ? "bg-pink-50" : "";
                  return (
                    <td key={dateKey} className={`border border-zinc-200 px-1.5 py-1 text-center ${bg}`}>
                      <input type="checkbox" checked={checked.has(key)} onChange={() => toggle(key)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

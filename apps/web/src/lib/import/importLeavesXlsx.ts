import type { EmployeeId, PiiEmployee } from "@shifuto/shared-core";
import { LEAVES_SHEET_NAME } from "./excelTemplate";
import { cellText, loadWorkbook, parseDateCell } from "./loadWorkbook";

export type ImportLeavesResult = {
  matched: { employeeId: EmployeeId; date: string }[];
  /** Rows whose 氏名 didn't match any registered employee, or whose 日付 didn't parse. */
  unmatchedRows: { name: string; date: string }[];
};

/** Reads the 希望休 sheet, resolving 氏名 against already-registered employees. */
export async function importLeavesXlsx(file: File, employees: PiiEmployee[]): Promise<ImportLeavesResult> {
  const employeeIdByName = new Map(employees.map((e) => [e.name, e.id]));
  const workbook = await loadWorkbook(file);
  const sheet = workbook.getWorksheet(LEAVES_SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) return { matched: [], unmatchedRows: [] };

  const matched: ImportLeavesResult["matched"] = [];
  const unmatchedRows: ImportLeavesResult["unmatchedRows"] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const name = cellText(row.getCell(1).value);
    const date = parseDateCell(row.getCell(2).value);
    if (!name || !date || name.startsWith("※")) return; // blank/note rows

    const employeeId = employeeIdByName.get(name);
    if (!employeeId) {
      unmatchedRows.push({ name, date: date ?? cellText(row.getCell(2).value) });
      return;
    }
    matched.push({ employeeId, date });
  });

  return { matched, unmatchedRows };
}

import { asEmployeeId, type PiiEmployee } from "@shifuto/shared-core";
import { EMPLOYEES_SHEET_NAME } from "./excelTemplate";
import { cellText, loadWorkbook } from "./loadWorkbook";

export type ImportEmployeesResult = {
  employees: PiiEmployee[];
  skippedRows: number;
};

/** Reads the 従業員 sheet (see excelTemplate.ts for the expected columns). */
export async function importEmployeesXlsx(file: File, nextSortOrder: number): Promise<ImportEmployeesResult> {
  const workbook = await loadWorkbook(file);
  const sheet = workbook.getWorksheet(EMPLOYEES_SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) return { employees: [], skippedRows: 0 };

  const employees: PiiEmployee[] = [];
  let skippedRows = 0;
  let sortOrder = nextSortOrder;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const name = cellText(row.getCell(1).value);
    // Blank rows, and defensively, any stray "※ note" text a user might
    // paste into the sheet — never treat it as a real employee name.
    if (!name || name.startsWith("※")) {
      skippedRows += 1;
      return;
    }
    const role = cellText(row.getCell(2).value) || null;
    const employmentTypeText = cellText(row.getCell(3).value);

    employees.push({
      id: asEmployeeId(crypto.randomUUID()),
      name,
      role,
      employmentType: employmentTypeText.includes("正社員") ? "full_time" : "part_time",
      isActive: true,
      sortOrder: sortOrder++,
    });
  });

  return { employees, skippedRows };
}

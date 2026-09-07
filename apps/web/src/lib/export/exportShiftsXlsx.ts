import ExcelJS from "exceljs";
import { WEEKDAY_LABELS_JA, weekdayOf, type AssignedShift, type PiiEmployee } from "@shifuto/shared-core";
import { HEADER_FILL, THIN_BORDER, writeTitleRows, downloadWorkbook } from "./xlsxCommon";

const SAT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
const SUN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE7F3" } };

function shiftCellText(shift: AssignedShift | undefined): string {
  if (!shift) return "";
  if (shift.shiftType === "leave") return "有休";
  if (shift.shiftType === "off") return "休";
  if (shift.startTime && shift.endTime) {
    return `${shift.startTime.slice(0, 5)}\n${shift.endTime.slice(0, 5)}`;
  }
  return "";
}

export async function exportShiftsXlsx({
  storeName,
  year,
  month,
  employees,
  dateKeys,
  shiftsByEmployeeDate,
  requiredCountByDate,
  dailyTotals,
  employeeTotals,
}: {
  storeName: string;
  year: number;
  month: number;
  employees: PiiEmployee[];
  dateKeys: string[];
  shiftsByEmployeeDate: Map<string, Map<string, AssignedShift>>;
  requiredCountByDate: Map<string, number>;
  dailyTotals: number[];
  employeeTotals: number[];
}): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${year}年${month}月`);

  sheet.getColumn(1).width = 22;
  for (let i = 0; i < dateKeys.length; i++) {
    sheet.getColumn(i + 2).width = 9;
  }
  sheet.getColumn(dateKeys.length + 2).width = 9;

  function weekendFill(dateKey: string): ExcelJS.Fill | undefined {
    const wd = weekdayOf(new Date(dateKey));
    if (wd === 6) return SAT_FILL;
    if (wd === 0) return SUN_FILL;
    return undefined;
  }

  writeTitleRows(sheet, `${year}年${month}月度シフト計画`, storeName, dateKeys.length + 2);
  sheet.addRow([]);

  const headerRow = sheet.addRow([
    "従業員",
    ...dateKeys.map((key) => {
      const d = new Date(key);
      return `${d.getDate()}(${WEEKDAY_LABELS_JA[weekdayOf(d)]})`;
    }),
    "合計(h)",
  ]);
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
    const dateKey = dateKeys[colNumber - 2];
    cell.fill = dateKey ? (weekendFill(dateKey) ?? HEADER_FILL) : HEADER_FILL;
  });

  const requiredRow = sheet.addRow([
    "必要人数",
    ...dateKeys.map((key) => requiredCountByDate.get(key) ?? 0),
    "",
  ]);
  requiredRow.eachCell((cell, colNumber) => {
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = THIN_BORDER;
    const dateKey = dateKeys[colNumber - 2];
    if (dateKey) cell.fill = weekendFill(dateKey) ?? HEADER_FILL;
    else if (colNumber === 1) cell.fill = HEADER_FILL;
  });

  for (let i = 0; i < employees.length; i++) {
    const employee = employees[i];
    const byDate = shiftsByEmployeeDate.get(employee.id);
    const label = employee.role ? `${employee.name}（${employee.role}）` : employee.name;
    const row = sheet.addRow([
      label,
      ...dateKeys.map((key) => shiftCellText(byDate?.get(key))),
      employeeTotals[i].toFixed(2),
    ]);
    row.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = THIN_BORDER;
      const dateKey = dateKeys[colNumber - 2];
      if (dateKey) {
        const fill = weekendFill(dateKey);
        if (fill) cell.fill = fill;
      }
    });
    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
  }

  const totalRow = sheet.addRow([
    "合計(h)",
    ...dailyTotals.map((t) => t.toFixed(2)),
    dailyTotals.reduce((sum, t) => sum + t, 0).toFixed(2),
  ]);
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = THIN_BORDER;
    const dateKey = dateKeys[colNumber - 2];
    cell.fill = dateKey ? (weekendFill(dateKey) ?? HEADER_FILL) : HEADER_FILL;
  });

  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 5 }];

  await downloadWorkbook(workbook, `シフト表_${year}年${month}月.xlsx`);
}

import ExcelJS from "exceljs";
import type { PiiEmployee } from "@shifuto/shared-core";

export const EMPLOYEES_SHEET_NAME = "従業員";
export const LEAVES_SHEET_NAME = "希望休";
const NOTES_SHEET_NAME = "使い方";

/**
 * Explanatory text lives on its own sheet, never as extra rows in a data
 * sheet — a note row mixed into the data area gets misread as a data row
 * by the importer (it did, once: a "※雇用形態は…" row became a phantom
 * employee). Keeping notes out of the data sheets removes that failure
 * mode entirely, rather than just guarding against it after the fact.
 */
function addNotesSheet(workbook: ExcelJS.Workbook, notes: string[]) {
  const sheet = workbook.addWorksheet(NOTES_SHEET_NAME);
  sheet.columns = [{ width: 70 }];
  for (const note of notes) sheet.addRow([note]);
}

async function download(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Template for bulk-registering new employees (sample rows to overwrite). */
export async function downloadEmployeesTemplate(): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet(EMPLOYEES_SHEET_NAME);
  sheet.columns = [
    { header: "氏名", key: "name", width: 16 },
    { header: "役割", key: "role", width: 14 },
    { header: "雇用形態", key: "employmentType", width: 16 },
  ];
  sheet.addRow({ name: "山田太郎", role: "ホール", employmentType: "パート/アルバイト" });
  sheet.addRow({ name: "鈴木花子", role: "キッチン", employmentType: "正社員" });
  sheet.getRow(1).font = { bold: true };

  addNotesSheet(workbook, [
    "雇用形態は「パート/アルバイト」または「正社員」。空欄はパート/アルバイト扱いになります。",
    "このシートの続きに行を追加して、従業員を何人でも登録できます。",
  ]);

  await download(workbook, "shifuto_従業員テンプレート.xlsx");
}

/**
 * Template for entering leave requests, pre-filled with the names of
 * already-registered employees — this screen only opens once employees
 * exist, so there's no reason to make the user retype names by hand (a
 * typo here silently drops the row as "unmatched").
 */
export async function downloadLeavesTemplate(employees: PiiEmployee[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet(LEAVES_SHEET_NAME);
  sheet.columns = [
    { header: "氏名", key: "name", width: 16 },
    { header: "日付", key: "date", width: 14 },
  ];
  for (const employee of employees) {
    sheet.addRow({ name: employee.name, date: "" });
  }
  sheet.getRow(1).font = { bold: true };

  addNotesSheet(workbook, [
    "氏名の行はあらかじめ登録済みの従業員で埋めてあります。休みの希望日を「日付」列に入力してください。",
    "同じ人が複数日休む場合は、その人の行をコピーして貼り付け、日付だけ変えてください。",
    "日付は YYYY-MM-DD 形式、またはExcelの日付セルで入力してください。",
  ]);

  await download(workbook, "shifuto_希望休テンプレート.xlsx");
}

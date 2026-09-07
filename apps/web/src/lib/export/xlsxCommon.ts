import ExcelJS from "exceljs";

export const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };

export const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD4D4D8" } },
  bottom: { style: "thin", color: { argb: "FFD4D4D8" } },
  left: { style: "thin", color: { argb: "FFD4D4D8" } },
  right: { style: "thin", color: { argb: "FFD4D4D8" } },
};

/**
 * Writes the two-row title block ("〇〇シフト計画" + store name) shared by
 * every export sheet, each merged across the full column span. Kept as two
 * separate rows (not one merged over both) because merging discards every
 * cell's value but the top-left one.
 */
export function writeTitleRows(sheet: ExcelJS.Worksheet, title: string, storeName: string, totalCols: number): void {
  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true, size: 14 };
  sheet.mergeCells(1, 1, 1, totalCols);

  const storeRow = sheet.addRow([storeName]);
  storeRow.font = { size: 11, color: { argb: "FF71717A" } };
  sheet.mergeCells(2, 1, 2, totalCols);
}

/** Serializes the workbook to .xlsx and triggers a browser download. */
export async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
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

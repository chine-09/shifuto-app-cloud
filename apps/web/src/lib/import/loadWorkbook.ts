import ExcelJS from "exceljs";

export async function loadWorkbook(file: File): Promise<ExcelJS.Workbook> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Accepts an Excel date cell (a real Date) or a YYYY-MM-DD / YYYY/MM/DD string. */
export function parseDateCell(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replaceAll("/", "-");
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
      const [y, m, d] = normalized.split("-").map(Number);
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
  }
  return null;
}

export function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && !(value instanceof Date) && "richText" in value) {
    return value.richText.map((r) => r.text).join("");
  }
  return String(value).trim();
}

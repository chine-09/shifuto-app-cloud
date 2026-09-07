import ExcelJS from "exceljs";
import type { PiiEmployee, TaskSegment, WorkTask } from "@shifuto/shared-core";
import { buildTimeTicks } from "../timeGrid";
import { HEADER_FILL, THIN_BORDER, writeTitleRows, downloadWorkbook } from "./xlsxCommon";

const BREAK_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4E4E7" } };

/** "#4ade80" -> "FF4ADE80" (ExcelJS ARGB, opaque). */
function toArgb(cssHexColor: string): string {
  return `FF${cssHexColor.replace("#", "").toUpperCase()}`;
}

/**
 * Exports the detailed (15-minute-resolution) Gantt view for a single day —
 * one row per employee, one column per 15-minute slot, each task segment
 * rendered as a merged, color-filled cell labeled with its task name (breaks
 * shown as "休憩"). Mirrors what's on screen in GanttDetailPage rather than
 * the coarse per-day totals in exportShiftsXlsx.
 */
export async function exportGanttDayXlsx({
  storeName,
  date,
  employees,
  segments,
  workTasks,
  gridStart,
  gridEnd,
}: {
  storeName: string;
  date: string;
  employees: PiiEmployee[];
  segments: TaskSegment[];
  workTasks: WorkTask[];
  gridStart: string;
  gridEnd: string;
}): Promise<void> {
  const ticks = buildTimeTicks(gridStart, gridEnd);
  const workTasksById = new Map(workTasks.map((t) => [t.id, t]));
  const segmentsByEmployee = new Map<string, TaskSegment[]>();
  for (const segment of segments) {
    const list = segmentsByEmployee.get(segment.employeeId) ?? [];
    list.push(segment);
    segmentsByEmployee.set(segment.employeeId, list);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(date);

  sheet.getColumn(1).width = 18;
  for (let i = 0; i < ticks.length; i++) sheet.getColumn(i + 2).width = 3;

  writeTitleRows(sheet, `${date} 分刻みシフト`, storeName, ticks.length + 1);
  sheet.addRow([]);

  const headerRowIndex = 4;
  const headerRow = sheet.addRow(["従業員", ...ticks.map(() => "")]);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
  });
  for (let i = 0; i < ticks.length; i++) {
    if (!ticks[i].endsWith(":00")) continue;
    let span = 1;
    while (i + span < ticks.length && !ticks[i + span].endsWith(":00")) span++;
    const startCol = i + 2;
    const endCol = Math.min(i + span, ticks.length) + 1;
    if (endCol > startCol) sheet.mergeCells(headerRowIndex, startCol, headerRowIndex, endCol);
    const cell = sheet.getCell(headerRowIndex, startCol);
    cell.value = `${ticks[i].slice(0, 2)}時`;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { bold: true, size: 9 };
  }

  for (const employee of employees) {
    const label = employee.role ? `${employee.name}（${employee.role}）` : employee.name;
    const row = sheet.addRow([label, ...ticks.map(() => "")]);
    row.eachCell((cell) => {
      cell.border = THIN_BORDER;
    });
    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
    const rowIndex = row.number;

    const empSegments = [...(segmentsByEmployee.get(employee.id) ?? [])].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
    for (const segment of empSegments) {
      const startIdx = ticks.indexOf(segment.startTime);
      if (startIdx === -1) continue; // outside the displayed grid range
      let endIdx = ticks.indexOf(segment.endTime);
      if (endIdx === -1) endIdx = ticks.length; // segment runs to (or past) gridEnd
      const startCol = startIdx + 2;
      const endCol = endIdx + 1;
      if (endCol < startCol) continue;
      if (endCol > startCol) sheet.mergeCells(rowIndex, startCol, rowIndex, endCol);

      const task = segment.taskId ? workTasksById.get(segment.taskId) : null;
      const cell = sheet.getCell(rowIndex, startCol);
      cell.value = task ? task.name : "休憩";
      cell.fill = task ? { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(task.color) } } : BREAK_FILL;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { size: 9 };
      cell.border = THIN_BORDER;
    }
  }

  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: headerRowIndex }];

  await downloadWorkbook(workbook, `分刻みシフト_${date}.xlsx`);
}

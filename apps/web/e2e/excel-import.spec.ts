import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

async function buildTestWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const emp = workbook.addWorksheet("従業員");
  emp.addRow(["氏名", "役割", "雇用形態"]);
  emp.addRow(["山田太郎", "ホール", "パート/アルバイト"]);
  emp.addRow(["鈴木花子", "キッチン", "正社員"]);
  emp.addRow([]); // blank row
  emp.addRow(["", "", ""]); // blank name row

  const leaves = workbook.addWorksheet("希望休");
  leaves.addRow(["氏名", "日付"]);
  leaves.addRow(["山田太郎", "2026-09-05"]);
  leaves.addRow(["山田太郎", new Date(2026, 8, 12)]); // real Excel date cell
  leaves.addRow(["存在しない太郎", "2026-09-20"]); // unmatched name

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test.describe("Excel import (employees + leave requests)", () => {
  test("imports employees from the 従業員 sheet, skipping blank-name rows", async ({ page }) => {
    const buffer = await buildTestWorkbook();
    await page.goto("/employees");
    await page.setInputFiles('input[type="file"][accept=".xlsx"]', {
      name: "test.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });

    await expect(page.locator('input[name="name"][value="山田太郎"]')).toBeVisible();
    await expect(page.locator('input[name="name"][value="鈴木花子"]')).toBeVisible();
    await expect(page.getByText(/2名を読み込みました/)).toBeVisible();
    await expect(page.getByText(/1件スキップ/)).toBeVisible();
  });

  test("imports leave requests, matches by name, and flags unmatched names", async ({ page }) => {
    const buffer = await buildTestWorkbook();
    await page.goto("/employees");
    await page.setInputFiles('input[type="file"][accept=".xlsx"]', {
      name: "test.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });
    await page.waitForSelector('input[name="name"][value="山田太郎"]');

    await page.click('a:has-text("TOP")');
    await page.fill('form input[type="number"] >> nth=0', "2026");
    await page.fill('form input[type="number"] >> nth=1', "9");
    await page.click('button:has-text("開く")');
    await page.waitForURL("**/plans/2026-09/leaves");

    await page.click('a:has-text("希望休入力")');
    await page.waitForSelector("table");
    await page.setInputFiles('input[type="file"][accept=".xlsx"]', {
      name: "test.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });

    await expect(page.getByText(/2件を取り込んで反映しました/)).toBeVisible();
    await expect(page.getByText(/存在しない太郎/)).toBeVisible();

    // both a plain string date ("2026-09-05") and a real Excel Date cell (2026-09-12) parsed correctly
    const row = page.locator("table tbody tr").first();
    await expect(row.locator('input[type="checkbox"]:checked')).toHaveCount(2);
  });
});

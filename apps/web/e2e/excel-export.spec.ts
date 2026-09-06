import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

test.describe("Excel output (leaves template pre-fill + shift export)", () => {
  test("the leave-request template is pre-filled with registered employee names", async ({ page }) => {
    await page.goto("/employees");
    await page.fill('input[name="name"]', "山田太郎");
    await page.click('button:has-text("追加")');
    await page.waitForSelector('input[name="name"][value="山田太郎"]');
    await page.fill('section input[name="name"] >> nth=0', "鈴木花子");
    await page.click('button:has-text("追加")');
    await page.waitForSelector('input[name="name"][value="鈴木花子"]');

    await page.click('a:has-text("TOP")');
    await page.fill('form input[type="number"] >> nth=0', "2026");
    await page.fill('form input[type="number"] >> nth=1', "9");
    await page.click('button:has-text("開く")');
    await page.waitForURL("**/plans/2026-09/leaves");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('button:has-text("テンプレートをダウンロード")'),
    ]);
    const path = await download.path();
    if (!path) throw new Error("download did not produce a local path");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path);
    const sheet = workbook.getWorksheet("希望休");
    if (!sheet) throw new Error("希望休 sheet missing from template");

    const names = [sheet.getRow(2).getCell(1).text, sheet.getRow(3).getCell(1).text];
    expect(names).toEqual(["山田太郎", "鈴木花子"]);
    // date column left blank for the user to fill in
    expect(sheet.getRow(2).getCell(2).text).toBe("");
  });

  test("the exported shift spreadsheet includes the store name", async ({ page }) => {
    await page.goto("/settings");
    await page.fill('input[type="text"]', "テスト食堂");

    await page.click('a:has-text("従業員")');
    await page.fill('input[name="name"]', "山田太郎");
    await page.click('button:has-text("追加")');
    await page.waitForSelector('input[name="name"][value="山田太郎"]');

    await page.click('a:has-text("TOP")');
    await page.fill('form input[type="number"] >> nth=0', "2026");
    await page.fill('form input[type="number"] >> nth=1', "9");
    await page.click('button:has-text("開く")');
    await page.waitForURL("**/plans/2026-09/leaves");
    await page.click('a:has-text("シフト表")');

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('button:has-text("Excelに出力")'),
    ]);
    const path = await download.path();
    if (!path) throw new Error("download did not produce a local path");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path);
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).getCell(1).text).toContain("シフト計画");
    expect(sheet.getRow(2).getCell(1).text).toBe("テスト食堂");
  });
});

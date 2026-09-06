import { expect, test } from "@playwright/test";

test.describe("core shift-planning flow (no backend required)", () => {
  test("register employees, build a shift, and see violations update live", async ({ page }) => {
    await page.goto("/employees");
    await page.fill('input[name="name"]', "山田太郎");
    await page.fill('input[name="role"]', "ホール");
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

    // headcount: require 2 people on day 1
    await page.click('a:has-text("必要人数設定")');
    await page.click('button[aria-label="2026-09-01に時間帯を追加"]');
    await page.fill(".border-blue-400 input[type=number]", "2");
    await page.click('button:has-text("追加")');

    // only one employee scheduled -> understaffed
    await page.click('a:has-text("シフト表")');
    await page.click('table tbody tr:first-child td[data-date-key="2026-09-01"]');
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("1件の違反が見つかりました")).toBeVisible();
    await expect(page.getByText("人員不足")).toBeVisible();

    // second employee fills the gap -> violation clears
    await page.click('table tbody tr:nth-child(2) td[data-date-key="2026-09-01"]');
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("問題は見つかりませんでした")).toBeVisible();
  });

  test("fill-handle drag copies a shift across the date axis", async ({ page }) => {
    await page.goto("/employees");
    await page.fill('input[name="name"]', "山田太郎");
    await page.click('button:has-text("追加")');
    await page.waitForSelector('input[name="name"][value="山田太郎"]');

    await page.click('a:has-text("TOP")');
    await page.fill('form input[type="number"] >> nth=0', "2026");
    await page.fill('form input[type="number"] >> nth=1', "9");
    await page.click('button:has-text("開く")');
    await page.waitForURL("**/plans/2026-09/leaves");
    await page.click('a:has-text("シフト表")');

    await page.click('table tbody tr:first-child td[data-date-key="2026-09-01"]');
    await page.getByRole("button", { name: "保存", exact: true }).click();

    const src = page.locator('td[data-date-key="2026-09-01"]');
    const srcBox = await src.boundingBox();
    const dst = page.locator('td[data-date-key="2026-09-03"]');
    const dstBox = await dst.boundingBox();
    if (!srcBox || !dstBox) throw new Error("cell not found");

    await page.mouse.move(srcBox.x + srcBox.width - 2, srcBox.y + srcBox.height - 2);
    await page.mouse.down();
    await page.mouse.move(dstBox.x + dstBox.width / 2, dstBox.y + dstBox.height / 2, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator('td[data-date-key="2026-09-02"]')).toContainText("09:00-17:00");
    await expect(page.locator('td[data-date-key="2026-09-03"]')).toContainText("09:00-17:00");
  });

  test("JSON export/import round-trips the full app state", async ({ page }) => {
    await page.goto("/employees");
    await page.fill('input[name="name"]', "山田太郎");
    await page.click('button:has-text("追加")');
    await page.waitForSelector('input[name="name"][value="山田太郎"]');

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('button:has-text("保存(ファイル)")'),
    ]);
    const path = await download.path();
    if (!path) throw new Error("download did not produce a local path");

    // fresh page, no data yet
    await page.goto("/employees");
    await expect(page.getByText("まだ従業員が登録されていません。")).toBeVisible();

    await page.setInputFiles('input[type="file"]', path);
    await expect(page.locator('input[name="name"][value="山田太郎"]')).toBeVisible();
    await expect(page.getByText("未保存の変更があります")).not.toBeVisible();
  });

  test("the cell edit popover stays fully on-screen even in a short viewport", async ({ page }) => {
    // Regression test: the popover used to be `position: absolute` inside the
    // table's `overflow-x-auto` wrapper, which clips vertical overflow too —
    // opening it on a bottom row cut off the save/cancel buttons. It now
    // portals to a viewport-fixed position that flips upward when needed.
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto("/employees");
    for (const name of ["社員1", "社員2", "社員3", "社員4", "社員5", "社員6"]) {
      await page.fill('section input[name="name"] >> nth=0', name);
      await page.click('button:has-text("追加")');
      await page.waitForSelector(`input[name="name"][value="${name}"]`);
    }

    await page.click('a:has-text("TOP")');
    await page.fill('form input[type="number"] >> nth=0', "2026");
    await page.fill('form input[type="number"] >> nth=1', "9");
    await page.click('button:has-text("開く")');
    await page.waitForURL("**/plans/2026-09/leaves");
    await page.click('a:has-text("シフト表")');

    await page.click('table tbody tr:last-child td[data-date-key="2026-09-01"]');
    const saveBtn = page.getByRole("button", { name: "保存", exact: true });
    await expect(saveBtn).toBeVisible();
    const box = await saveBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(500);
    await saveBtn.click(); // must actually be clickable, not just present in the DOM
  });

  test("beforeunload warns when there are unsaved changes", async ({ page }) => {
    await page.goto("/employees");
    await page.fill('input[name="name"]', "山田太郎");
    await page.click('button:has-text("追加")');
    await page.waitForSelector('input[name="name"][value="山田太郎"]');

    let sawBeforeUnload = false;
    page.on("dialog", async (dialog) => {
      sawBeforeUnload = dialog.type() === "beforeunload";
      await dialog.accept();
    });
    await page.goto("/");
    expect(sawBeforeUnload).toBe(true);
  });
});

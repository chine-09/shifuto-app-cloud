import { expect, test } from "@playwright/test";

test.describe("headcount calendar", () => {
  test("editing an existing slot's time closes the editor as soon as a full time is entered", async ({ page }) => {
    // Regression test: editing relied on onBlur to commit, which only fires
    // when focus leaves the field entirely — finishing the minute picker
    // alone left the editor open with no visible feedback. It should now
    // close as soon as the native time input reports a complete value.
    await page.goto("/employees");
    await page.fill('input[name="name"]', "山田太郎");
    await page.click('button:has-text("追加")');
    await page.waitForSelector('input[name="name"][value="山田太郎"]');

    await page.click('a:has-text("TOP")');
    await page.fill('form input[type="number"] >> nth=0', "2026");
    await page.fill('form input[type="number"] >> nth=1', "9");
    await page.click('button:has-text("開く")');
    await page.waitForURL("**/plans/2026-09/leaves");
    await page.click('a:has-text("必要人数設定")');

    await page.click('button[aria-label="2026-09-01に時間帯を追加"]');
    await page.click('button:has-text("追加")');
    await page.waitForSelector('button:has-text("09:00-17:00")');

    await page.click('button:has-text("09:00-17:00")');
    const timeInputs = page.locator('input[type="time"].border-blue-400');
    await expect(timeInputs).toHaveCount(2);

    await timeInputs.nth(1).fill("17:30");

    await expect(timeInputs).toHaveCount(0);
    await expect(page.getByRole("button", { name: "09:00-17:30" })).toBeVisible();
  });

  test("元に戻す undoes an accidental bulk headcount set in one step", async ({ page }) => {
    await page.goto("/employees");
    await page.fill('input[name="name"]', "山田太郎");
    await page.click('button:has-text("追加")');
    await page.waitForSelector('input[name="name"][value="山田太郎"]');

    await page.click('a:has-text("TOP")');
    await page.fill('form input[type="number"] >> nth=0', "2026");
    await page.fill('form input[type="number"] >> nth=1', "9");
    await page.click('button:has-text("開く")');
    await page.waitForURL("**/plans/2026-09/leaves");
    await page.click('a:has-text("必要人数設定")');

    const undoButton = page.getByRole("button", { name: "元に戻す", exact: true });

    // Defaults already span the whole month at 09:00-17:00, 1人 — a single
    // click is exactly the kind of accidental whole-month overwrite this
    // feature exists for.
    await page.click('button:has-text("一括設定")');
    await expect(page.getByText("設定済みの必要人数（30件）")).toBeVisible();

    await undoButton.click();
    await expect(page.getByText("設定済みの必要人数（0件）")).toBeVisible();
  });
});

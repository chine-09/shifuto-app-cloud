import { expect, test } from "@playwright/test";

test.describe("auto-assign (Lambda call mocked — no live backend needed)", () => {
  test("sends no PII to the API and rehydrates the real name in the UI", async ({ page }) => {
    let capturedRequestBody = "";

    await page.route("**/auto-assign", async (route) => {
      capturedRequestBody = route.request().postData() ?? "";
      const req = JSON.parse(capturedRequestBody);
      const employeeId = req.employees[0].id;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assignedShifts: [
            { employeeId, date: "2026-09-01", shiftType: "work", startTime: "09:00", endTime: "17:00" },
          ],
          violations: [],
        }),
      });
    });

    await page.goto("/employees");
    page.on("dialog", (dialog) => dialog.accept());
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

    await page.click('a:has-text("シフト表")');
    await page.click('button:has-text("自動割当")');
    await expect(page.locator('td[data-date-key="2026-09-01"]')).toContainText("09:00-17:00");

    // the core privacy guarantee: the wire payload carries no name, anywhere.
    expect(capturedRequestBody).not.toContain("山田太郎");
    expect(capturedRequestBody).not.toContain('"name"');
    const parsed = JSON.parse(capturedRequestBody);
    expect(parsed.employees[0].__anonymized).toBe(true);
  });

  test("surfaces an error instead of crashing when the API call fails", async ({ page }) => {
    await page.route("**/auto-assign", (route) => route.fulfill({ status: 500, body: "internal error" }));

    await page.goto("/employees");
    await page.fill('input[name="name"]', "山田太郎");
    await page.click('button:has-text("追加")');
    await page.waitForSelector('input[name="name"][value="山田太郎"]');

    await page.click('a:has-text("TOP")');
    await page.fill('form input[type="number"] >> nth=0', "2026");
    await page.fill('form input[type="number"] >> nth=1', "9");
    await page.click('button:has-text("開く")');
    await page.waitForURL("**/plans/2026-09/leaves");

    // auto-assign refuses to call the API with no headcount requirements set,
    // so set one up first to reach the (mocked, failing) API call.
    await page.click('a:has-text("必要人数設定")');
    await page.click('button[aria-label="2026-09-01に時間帯を追加"]');
    await page.click('button:has-text("追加")');

    await page.click('a:has-text("シフト表")');
    await page.click('button:has-text("自動割当")');
    await expect(page.getByText(/自動割当の計算に失敗しました/)).toBeVisible();
  });

  test("guides the user to set headcount requirements before allowing auto-assign", async ({ page }) => {
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

    await page.click('button:has-text("自動割当")');
    await expect(page.getByText(/必要人数が設定されていません/)).toBeVisible();
  });
});

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // CI runs on Linux, where Playwright's bundled Chromium works fine.
        // Locally this repo targets a macOS version Playwright's bundled
        // Chromium doesn't support, so fall back to the system-installed
        // Google Chrome (`npx playwright install chrome` if missing).
        channel: process.env.CI ? undefined : "chrome",
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    env: {
      // Dummy but present: the auto-assign spec intercepts this URL with
      // page.route(), so no real Lambda is ever contacted in tests.
      VITE_API_BASE_URL: "http://localhost:9999",
    },
  },
});

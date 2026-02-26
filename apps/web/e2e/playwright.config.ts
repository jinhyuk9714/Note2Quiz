import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "on-failure" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command:
        "cd ../../api && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000",
      port: 8000,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ANTHROPIC_API_KEY: "test-mock-key",
        RATE_LIMIT_ENABLED: "false",
      },
    },
    {
      command: "pnpm dev --port 3000",
      port: 3000,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

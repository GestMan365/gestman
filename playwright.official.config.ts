import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-official",
  globalSetup: "./tests/e2e-official/global-setup.mjs",
  globalTeardown: "./tests/e2e-official/global-teardown.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["line"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "desktop-1366",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
  ],
  webServer: {
    command: "node scripts/serve-official-staging.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

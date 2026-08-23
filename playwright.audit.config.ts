import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/local-audit",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173/nadirteste/",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/nadirteste/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

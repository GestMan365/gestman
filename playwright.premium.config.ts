import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/premium', workers: 1, timeout: 180000, reporter: 'line',
  outputDir: 'test-results/premium',
  use: { baseURL: 'http://127.0.0.1:4186', viewport: { width: 1440, height: 960 }, screenshot: 'only-on-failure', actionTimeout:10000 },
  webServer: { command: 'node scripts/serve-preventive-local-qa.mjs', url: 'http://127.0.0.1:4186/ui-audit', reuseExistingServer: true },
});

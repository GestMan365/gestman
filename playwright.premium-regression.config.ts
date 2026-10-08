import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/local-audit', workers:2, timeout:60000, reporter:'line',
  outputDir:'test-results/premium-regression',
  use:{baseURL:'http://127.0.0.1:4190/',viewport:{width:1366,height:768},screenshot:'only-on-failure'},
  webServer:{command:'node scripts/serve-preventive-local-qa.mjs',env:{GM_QA_PORT:'4190',GM_QA_PLAIN_ROOT:'1'},url:'http://127.0.0.1:4190',reuseExistingServer:false},
});

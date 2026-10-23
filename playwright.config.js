// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 3100;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm start',
    url: `http://localhost:${PORT}/api/plans`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false
  }
});

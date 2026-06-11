import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Retry once on CI to reduce flakiness from cold-start timing
  retries: process.env.CI ? 1 : 0,

  // Single worker in CI for stable resource usage; parallel locally
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3000',

    // Attach trace on retry so failures are debuggable
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // In CI, Node is already on the PATH via actions/setup-node — no nvm needed.
    // Locally, source nvm.sh explicitly because non-interactive bash won't run
    // ~/.bashrc, and npm_config_prefix conflicts with nvm's PATH management.
    command: process.env.CI
      ? 'npm run dev'
      : 'bash -c "unset npm_config_prefix && source ~/.nvm/nvm.sh && npm run dev"',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,

    // Provide a dummy session password so nuxt-auth-utils can initialize.
    // Tests that need auth use page.route() to mock the session API; no real
    // database calls are made during E2E tests.
    env: {
      NUXT_SESSION_PASSWORD: 'playwright-test-only-secret-minimum-32-chars',
      // Activates server/middleware/test-auth.ts — NEVER set in production
      PLAYWRIGHT_TEST: 'true',
    },
  },
})

import { defineConfig } from '@playwright/test'
import { requireLocalUrl } from './support.mjs'

requireLocalUrl(process.env.MFA_TEST_SUPABASE_URL, 54321)
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== process.env.MFA_TEST_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== process.env.MFA_TEST_PUBLIC_KEY) {
  throw new Error('Application and browser-test Supabase configuration must match.')
}

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.mjs',
  workers: 1,
  retries: 0,
  timeout: 180000,
  expect: { timeout: 15000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    browserName: 'chromium',
    // Traces/screenshots can contain TOTP setup keys, OTPs and access tokens.
    trace: 'off', screenshot: 'off', video: 'off',
  },
  webServer: {
    command: 'npm run start --prefix ../../admin -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: false,
    timeout: 60000,
    stdout: 'ignore', stderr: 'pipe',
  },
})

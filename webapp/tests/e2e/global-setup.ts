/**
 * Playwright global setup — runs once before any test worker starts.
 *
 * Looks up the E2E test user by TEST_USER_USERNAME and writes their DB id,
 * username, and email to .test-user.json so each test can authenticate as a
 * real DB user without re-querying the database.
 *
 * Fails fast with a clear message if the test user does not exist, pointing
 * to `npm run seed:test-user` as the fix.
 *
 * Also verifies that the server was started with PLAYWRIGHT_TEST=true so that
 * the test-auth middleware is active.  If a plain `npm run dev` server is
 * already running on port 3000, authenticated tests will silently fail; this
 * check catches that situation before any test worker starts.
 */

import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { writeFileSync } from 'fs'
import { join } from 'path'

const OUT_FILE = join(process.cwd(), 'tests/e2e/.test-user.json')

const PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

async function verifyTestAuthMiddleware() {
  const probe = { id: -1, username: '_health_', email: 'health@test', isGenerator: false, isBuyer: false, isAdmin: false }
  const { status, data } = await fetch(`${PLAYWRIGHT_BASE_URL}/api/_auth/session`, {
    headers: { 'x-playwright-user': JSON.stringify(probe), accept: 'application/json' },
  }).then(async res => ({
    status: res.status,
    data:   await res.json() as Record<string, unknown>,
  })).catch((err: unknown) => {
    throw new Error(
      `Could not reach the dev server at ${PLAYWRIGHT_BASE_URL}.\n` +
      `Error: ${(err as Error).message}`,
    )
  })

  if (status !== 200) {
    throw new Error(
      `GET /api/_auth/session returned HTTP ${status} — the server may not be healthy.`,
    )
  }

  if (!data?.user) {
    throw new Error(
      `The server at ${PLAYWRIGHT_BASE_URL} does NOT have PLAYWRIGHT_TEST=true — ` +
      `the test-auth middleware is inactive and authenticated tests will fail.\n\n` +
      `Fix: stop any running "npm run dev" server and re-run the tests so Playwright ` +
      `can start its own server with the correct environment variables.`,
    )
  }
  console.log('[global-setup] test-auth middleware verified ✓')
}

export default async function globalSetup() {
  const { DATABASE_URL, TEST_USER_USERNAME } = process.env

  await verifyTestAuthMiddleware()

  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Ensure it is defined in your .env file.')
  }
  if (!TEST_USER_USERNAME) {
    throw new Error('TEST_USER_USERNAME is not set. Ensure it is defined in your .env file.')
  }

  const sql = neon(DATABASE_URL)

  const deleted = await sql`
    DELETE FROM onboarding_submissions
    WHERE project_name LIKE '[Playwright Test]%'
    RETURNING id
  `
  if (deleted.length) console.log(`[global-setup] Deleted ${deleted.length} stale [Playwright Test] submission(s).`)

  const rows = await sql`
    SELECT id, username, email, is_generator, is_buyer
    FROM users
    WHERE username = ${TEST_USER_USERNAME}
    LIMIT 1
  `

  if (!rows.length) {
    throw new Error(
      `Playwright test user (username="${TEST_USER_USERNAME}") not found in DB.\n` +
      'Run:  npm run seed:test-user',
    )
  }

  const user = rows[0]
  if (!user.is_generator || !user.is_buyer) {
    throw new Error(
      `Test user id=${user.id} exists but is not a generator+buyer. ` +
      'Run:  npm run seed:test-user  to fix the flags.',
    )
  }

  writeFileSync(OUT_FILE, JSON.stringify({
    userId:   user.id,
    username: user.username,
    email:    user.email,
  }))
  console.log(`[global-setup] Test user id=${user.id} (${user.username}) ready.`)
}

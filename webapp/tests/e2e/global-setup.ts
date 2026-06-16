/**
 * Playwright global setup — runs once before any test worker starts.
 *
 * Looks up the E2E test user by TEST_USER_USERNAME and writes their DB id,
 * username, and email to .test-user.json so each test can authenticate as a
 * real DB user without re-querying the database.
 *
 * Fails fast with a clear message if the test user does not exist, pointing
 * to `npm run seed:test-user` as the fix.
 */

import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { writeFileSync } from 'fs'
import { join } from 'path'

const OUT_FILE = join(process.cwd(), 'tests/e2e/.test-user.json')

export default async function globalSetup() {
  const { DATABASE_URL, TEST_USER_USERNAME } = process.env

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

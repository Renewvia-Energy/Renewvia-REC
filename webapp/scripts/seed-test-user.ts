/**
 * seed-test-user.ts
 * Creates the Playwright E2E test user in the database.
 * The test user is a generator and buyer but NOT an admin.
 *
 * Usage:
 *   npm run seed:test-user
 *
 * Reads DATABASE_URL, TEST_USER_USERNAME, and TEST_USER_EMAIL from .env.
 * Safe to run repeatedly — upserts on username conflict.
 *
 * Run `npm run db:push` first to ensure the schema exists.
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import { users } from '../server/db/schema'

const DATABASE_URL    = process.env.DATABASE_URL
const TEST_USERNAME   = process.env.TEST_USER_USERNAME
const TEST_EMAIL      = process.env.TEST_USER_EMAIL

if (!DATABASE_URL)  { console.error('Missing DATABASE_URL');    process.exit(1) }
if (!TEST_USERNAME) { console.error('Missing TEST_USER_USERNAME'); process.exit(1) }
if (!TEST_EMAIL)    { console.error('Missing TEST_USER_EMAIL');    process.exit(1) }

const sql = neon(DATABASE_URL)
const db  = drizzle(sql)

console.log(`Upserting playwright test user: ${TEST_EMAIL}…`)

const [existing] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.username, TEST_USERNAME))

let result: { id: number; username: string; email: string }

if (existing) {
  ;[result] = await db
    .update(users)
    .set({ isGenerator: true, isBuyer: true, isAdmin: false })
    .where(eq(users.username, TEST_USERNAME))
    .returning({ id: users.id, username: users.username, email: users.email })
  console.log(`✓ Updated existing test user (id=${result.id})`)
} else {
  ;[result] = await db
    .insert(users)
    .values({
      username:      TEST_USERNAME,
      email:         TEST_EMAIL,
      passwordHash:  'playwright-test-not-a-real-password',
      isGenerator:   true,
      isBuyer:       true,
      isAdmin:       false,
      companyWallet: null,
      createdBy:     null,
    })
    .returning({ id: users.id, username: users.username, email: users.email })
  console.log(`✓ Created new test user (id=${result.id})`)
}

console.log(`Test user id=${result.id} username=${result.username}`)
console.log('E2E tests will look up this user by username automatically via global-setup.ts.')

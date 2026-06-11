/**
 * seed-admin.ts
 * Creates the first admin user directly in the database.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Reads from .env automatically. Required variables:
 *   DATABASE_URL          — Neon connection string
 *   ADMIN_EMAIL           — email address for the admin account
 *   ADMIN_PASSWORD        — password (≥12 chars)
 *   ADMIN_COMPANY_WALLET  — (optional) lowercase wallet address to link this admin to a company
 *
 * Run `npm run db:push` first to ensure the schema exists.
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { hash } from 'bcryptjs'
import { users } from '../server/db/schema'

const DATABASE_URL          = process.env.DATABASE_URL
const ADMIN_USERNAME        = process.env.ADMIN_USERNAME
const ADMIN_EMAIL           = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD        = process.env.ADMIN_PASSWORD
const ADMIN_COMPANY_WALLET  = process.env.ADMIN_COMPANY_WALLET?.toLowerCase().trim() || null

if (!DATABASE_URL)    { console.error('Missing DATABASE_URL');    process.exit(1) }
if (!ADMIN_USERNAME)  { console.error('Missing ADMIN_USERNAME');  process.exit(1) }
if (!ADMIN_EMAIL)     { console.error('Missing ADMIN_EMAIL');     process.exit(1) }
if (!ADMIN_PASSWORD)  { console.error('Missing ADMIN_PASSWORD');  process.exit(1) }
if (ADMIN_PASSWORD.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters')
  process.exit(1)
}

const sql = neon(DATABASE_URL)
const db  = drizzle(sql)

console.log(`Creating admin user: ${ADMIN_EMAIL}…`)
if (ADMIN_COMPANY_WALLET) {
  console.log(`  Linked to company wallet: ${ADMIN_COMPANY_WALLET}`)
}

const passwordHash = await hash(ADMIN_PASSWORD, 12)

const [created] = await db.insert(users).values({
  username:      ADMIN_USERNAME.trim().toLowerCase(),
  email:         ADMIN_EMAIL.toLowerCase().trim(),
  passwordHash,
  isGenerator:   false,
  isBuyer:       false,
  isAdmin:       true,
  companyWallet: ADMIN_COMPANY_WALLET,
  createdBy:     null, // no creator — this is the bootstrap admin
}).returning({ id: users.id, username: users.username, email: users.email })

console.log(`✓ Admin user created (id=${created.id}, username=${created.username}, email=${created.email})`)
console.log('You can now log in at /login with these credentials.')

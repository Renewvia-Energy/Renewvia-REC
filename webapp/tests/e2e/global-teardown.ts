import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

export default async function globalTeardown() {
  const { DATABASE_URL } = process.env
  if (!DATABASE_URL) return

  const sql = neon(DATABASE_URL)
  const deleted = await sql`
    DELETE FROM onboarding_submissions
    WHERE project_name LIKE '[Playwright Test]%'
    RETURNING id
  `
  if (deleted.length) console.log(`[global-teardown] Deleted ${deleted.length} [Playwright Test] submission(s).`)
}

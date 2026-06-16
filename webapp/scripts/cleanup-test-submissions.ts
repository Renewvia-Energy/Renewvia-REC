/**
 * cleanup-test-submissions.ts
 * Deletes all onboarding submissions whose project name starts with
 * "[Playwright Test]".  Safe to run at any time.
 *
 * Usage:
 *   npm run cleanup:test-submissions
 */

import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('Missing DATABASE_URL'); process.exit(1) }

const sql = neon(DATABASE_URL)

const deleted = await sql`
  DELETE FROM onboarding_submissions
  WHERE project_name LIKE '[Playwright Test]%'
  RETURNING id, project_name
`

if (deleted.length === 0) {
  console.log('No [Playwright Test] submissions found.')
} else {
  for (const row of deleted) {
    console.log(`  Deleted id=${row.id}  "${row.project_name}"`)
  }
  console.log(`Deleted ${deleted.length} submission(s).`)
}

import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

// ── Test user ──────────────────────────────────────────────────────────────────
// global-setup.ts resolves the real DB user id and writes it here before any
// test worker starts.  Run `npm run seed:test-user` once to create the user.
const { userId, username, email } = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/e2e/.test-user.json'), 'utf8'),
) as { userId: number; username: string; email: string }

const GENERATOR_USER = {
  id:            userId,
  username,
  email,
  companyWallet: null,
  isGenerator:   true,
  isBuyer:       true,
  isAdmin:       false,
}

// ── PDF generator ──────────────────────────────────────────────────────────────
// Produces a minimal structurally-valid PDF whose text Gemini can extract.
// Avoids PDF special characters ( ) \ in line content.
function makePdf(lines: string[]): Buffer {
  const parts = ['BT', '/F1 12 Tf', '50 750 Td']
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) parts.push('0 -18 Td')
    parts.push(`(${lines[i]}) Tj`)
  }
  parts.push('ET')
  const stream = parts.join('\n')
  const streamLen = stream.length

  const h  = '%PDF-1.4\n'
  const o1 = '1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n'
  const o2 = '2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n'
  const o3 = '3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>>\nendobj\n'
  const o4 = '4 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n'
  const o5 = `5 0 obj\n<</Length ${streamLen}>>\nstream\n${stream}\nendstream\nendobj\n`
  const objs = [o1, o2, o3, o4, o5]

  const offsets: number[] = []
  let pos = h.length
  for (const obj of objs) { offsets.push(pos); pos += obj.length }

  // Each xref entry must be 20 bytes: 10 offset + SP + 5 gen + SP + keyword + SP + LF
  const xrefEntries = offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  const xref    = `xref\n0 6\n0000000000 65535 f \n${xrefEntries}`
  const trailer = `trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${pos}\n%%EOF\n`

  return Buffer.from(h + objs.join('') + xref + trailer, 'ascii')
}

// ── Fixture documents ──────────────────────────────────────────────────────────

// Single comprehensive commissioning report reused across all doc sections in
// test 1 — it states energy source, capacity, coordinates, and date clearly,
// and explicitly says it was approved by the local government authority so
// Gemini consistently matches the "approved by the local government" doc type.
const COMMISSIONING_REPORT = makePdf([
  'PROJECT COMMISSIONING REPORT',
  'Approved and certified by the Regional Government Authority',
  'This document has been officially approved by the local government.',
  'Primary energy source: Solar photovoltaic',
  'Installed capacity: 50 kWp',
  'Site coordinates: Latitude -0.12 degrees  Longitude 34.57 degrees',
  'Date of commissioning: 15 January 2020',
  'Commissioning engineer: J. Smith  License No. ENG-2020-001',
])

// Invoice — clearly NOT a commissioning report (triggers documentTypeMatches: false).
const INVOICE_PDF = makePdf([
  'COMMERCIAL INVOICE',
  'Services rendered: IT consulting services',
  'Invoice number: 12345',
  'Amount due: 1000 USD',
  'Payment terms: Net 30 days',
])

// Spec sheet showing 5 Wp — contradicts a 50 kWp capacity claim (triggers contentMatches: false).
const LOW_CAPACITY_PDF = makePdf([
  'EQUIPMENT SPECIFICATION SHEET',
  'Product model: Mini-PV-001',
  'Rated output: 5 Wp',
  'Quantity: 1 unit',
  'Manufacturer: TinyPower Ltd',
])

// Dummy JPEG bytes used for photo uploads. These are not a valid image; Gemini
// returns an error so photo sections end in 'error' state (no warning shown).
// Test 1 mocks photo-analyze responses so the happy-path "no warnings" assertion
// is reliable regardless of how the model handles invalid image bytes.
const DUMMY_JPEG = Buffer.alloc(64, 0xff)

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Add the x-playwright-user header to local API calls only.
 *
 * page.setExtraHTTPHeaders would inject the header into cross-origin R2 upload
 * requests too, causing CORS preflights to fail (R2's CORS rule only allows
 * the Content-Type header).  Using page.route('/api/**') scopes the header
 * injection to localhost:3000, leaving R2 requests untouched.
 */
async function setupTestAuth(page: Page, user: object) {
  // '/**' resolves to http://localhost:3000/** (same-origin only) — cross-origin
  // R2 upload requests are not intercepted and never receive the header.
  // This avoids the CORS preflight failure that setExtraHTTPHeaders causes by
  // injecting x-playwright-user into the R2 PUT (R2's CORS rule allows only
  // Content-Type, so the preflight rejects any unknown request header).
  await page.route('/**', async route => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        'x-playwright-user': JSON.stringify(user),
      },
    })
  })
}

/** Click "View file ↗" and assert the popup resolves to a presigned R2 URL. */
async function assertViewLink(page: Page) {
  // The popup is a separate Page in the same browser context and doesn't carry
  // the page-level x-playwright-user header, so /api/uploads/view returns 401.
  // Register the context route right before opening the popup so it doesn't
  // interfere with step navigation earlier in the test.
  await page.context().route('**/api/uploads/view**', async route => {
    const fileUrl = new URL(route.request().url()).searchParams.get('url') ?? ''
    await route.fulfill({ status: 307, headers: { Location: fileUrl } })
  })

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByText('View file ↗').click(),
  ])
  await popup.waitForURL(/r2\./, { waitUntil: 'commit' })
  await popup.close()
}

/**
 * Poll until Gemini returns a mismatch warning, retrying on transient errors.
 * Tolerates 503/429 rate-limit responses that show a Retry button.
 */
async function waitForMismatch(page: Page) {
  await expect.poll(async () => {
    if (await page.getByText('Document may not match your submission').isVisible()) return 'mismatch'
    if (await page.getByText(/Verification (service temporarily )?unavailable/).isVisible()) {
      await page.getByRole('button', { name: 'Retry' }).click()
    }
    return 'pending'
  }, { timeout: 240_000, intervals: [5_000, 15_000, 30_000] }).toBe('mismatch')
}

/**
 * After "Submission received" appears, verify the submission is in the database
 * by calling GET /api/onboarding (authenticated as the test user via the extra
 * header) and asserting a pending submission with the given project name exists.
 */
async function assertInDb(page: Page, expectedProjectName: string) {
  const data = await page.evaluate(async () => {
    const res = await fetch('/api/onboarding')
    return res.json()
  }) as { submissions: Array<{ projectName: string; status: string }> }

  expect(
    data.submissions.some(s => s.projectName === expectedProjectName && s.status === 'pending'),
    `Expected a pending submission named "${expectedProjectName}" in DB`,
  ).toBe(true)
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Onboarding — generator project submission', () => {

  // ── Test 1: Happy path ────────────────────────────────────────────────────────
  test('submits a perfect project with all document verifications passing', async ({ page }) => {
    // Add x-playwright-user only to local API calls (not cross-origin R2 uploads).
    await setupTestAuth(page, GENERATOR_USER)

    // Photo-analyze is mocked because DUMMY_JPEG is not a valid image: without the
    // mock, Gemini errors on photos (which is fine — error ≠ warning), but the
    // outcome is non-deterministic and could theoretically flip to a warning.
    // route.fallback() (not route.continue()) lets non-photo calls fall through to
    // the setupTestAuth /api/** handler so they carry the x-playwright-user header.
    await page.route('/api/onboarding/analyze', async route => {
      const body = JSON.parse(route.request().postData() ?? '{}') as { section: string }
      if (body.section === 'photosGen' || body.section === 'photosMeter') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ documentTypeMatches: null, contentMatches: true, reasonForFalse: null }),
        })
      }
      return route.fallback()
    })

    // networkidle waits until no network connections remain for 500 ms, which
    // guarantees all JS bundles have loaded and Vue has fully hydrated the page.
    await page.goto('/onboarding', { waitUntil: 'networkidle' })

    // Step 1 — Project info
    await page.locator('#ob-project-name').fill('[Playwright Test] Test Solar Farm')
    await page.locator('#ob-project-type').selectOption('Utility')
    await page.locator('#ob-annual-gen').fill('100')
    await page.getByRole('button', { name: 'Continue' }).click()
    // Brief pause to let Vue's reactive update flush before Playwright queries the
    // new step's DOM — avoids a race between the microtask queue and CDP queries.
    await page.waitForTimeout(300)

    // Step 2 — Generation type: upload commissioning report; real R2 + real Gemini
    await page.locator('#ob-gen-type').selectOption('solar')
    await page.getByLabel('Document type').selectOption(
      'Project commissioning report approved by the local government',
    )
    await page.getByLabel('Upload document (PDF, JPG, PNG, WEBP — max 20 MB)').setInputFiles({
      name: 'commissioning-report.pdf',
      mimeType: 'application/pdf',
      buffer: COMMISSIONING_REPORT,
    })
    await expect(page.getByText('✓ Uploaded')).toBeVisible({ timeout: 15_000 })
    await assertViewLink(page)
    await expect(page.getByText('Document verified ✓')).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 3 — Capacity: reuse the commissioning report (it states "50 kWp")
    await page.locator('#ob-capacity').fill('50')
    await page.getByLabel('Reuse a previously uploaded document').selectOption({
      label: 'Project commissioning report approved by the local government',
    })
    await expect(page.getByText('Document verified ✓')).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 4 — Location
    await page.locator('#ob-lat').fill('-0.12')
    await page.locator('#ob-lon').fill('34.57')
    await page.getByLabel('Reuse a previously uploaded document').selectOption({
      label: 'Project commissioning report approved by the local government',
    })
    await expect(page.getByText('Document verified ✓')).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 5 — Date of first operation
    await page.locator('#ob-first-op-date').fill('2020-01-15')
    await page.getByLabel('Reuse a previously uploaded document').selectOption({
      label: 'Project commissioning report approved by the local government',
    })
    await expect(page.getByText('Document verified ✓')).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 6 — Equipment photos: real R2 upload, analyze mocked above
    await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
      name: 'equipment-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: DUMMY_JPEG,
    })
    await expect(page.getByText('Uploaded')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 7 — Metering photos: real R2 upload, analyze mocked above
    await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
      name: 'meter-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: DUMMY_JPEG,
    })
    await expect(page.getByText('Uploaded')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 8 — Review: no warnings; submit succeeds
    await expect(page.getByRole('button', { name: 'Submit for review' })).toBeVisible()
    await expect(page.locator('text=I understand and want to submit anyway')).toBeHidden()
    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByRole('heading', { name: 'Submission received' })).toBeVisible()

    await assertInDb(page, '[Playwright Test] Test Solar Farm')
  })

  // ── Test 2: Wrong document type ───────────────────────────────────────────────
  test('warns when a wrong document type is uploaded and requires acknowledgement to submit', async ({ page }) => {
    await setupTestAuth(page, GENERATOR_USER)

    await page.goto('/onboarding', { waitUntil: 'networkidle' })

    // Step 1 — Project info
    await page.locator('#ob-project-name').fill('[Playwright Test] Wrong Gen Doc')
    await page.locator('#ob-project-type').selectOption('Utility')
    await page.locator('#ob-annual-gen').fill('100')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 2 — Upload an invoice claiming it is a commissioning report (wrong type)
    await page.locator('#ob-gen-type').selectOption('solar')
    await page.getByLabel('Document type').selectOption(
      'Project commissioning report approved by the local government',
    )
    await page.getByLabel('Upload document (PDF, JPG, PNG, WEBP — max 20 MB)').setInputFiles({
      name: 'invoice.pdf',
      mimeType: 'application/pdf',
      buffer: INVOICE_PDF,
    })
    await expect(page.getByText('✓ Uploaded')).toBeVisible({ timeout: 15_000 })
    await assertViewLink(page)
    // Gemini should flag the document type as mismatched.
    // Rate limits (503/429) from earlier calls in the suite may require retries.
    await waitForMismatch(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Steps 3–5: upload the commissioning report fresh for each section.
    // After step 2, the reuse dropdown defaults to "Upload a new document" since
    // no doc has been saved for cap/loc/date, so the file picker is immediately
    // visible — no need to change the reuse dropdown selection.

    // Step 3 — Capacity
    await page.locator('#ob-capacity').fill('50')
    await page.getByLabel('Document type').selectOption(
      'Project commissioning report approved by the local government',
    )
    await page.getByLabel('Upload document (PDF, JPG, PNG, WEBP — max 20 MB)').setInputFiles({
      name: 'commissioning-report.pdf',
      mimeType: 'application/pdf',
      buffer: COMMISSIONING_REPORT,
    })
    await expect(page.getByText('✓ Uploaded')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Document verified ✓')).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 4 — Location
    await page.locator('#ob-lat').fill('-0.12')
    await page.locator('#ob-lon').fill('34.57')
    await page.getByLabel('Document type').selectOption(
      'Project commissioning report approved by the local government',
    )
    await page.getByLabel('Upload document (PDF, JPG, PNG, WEBP — max 20 MB)').setInputFiles({
      name: 'commissioning-report.pdf',
      mimeType: 'application/pdf',
      buffer: COMMISSIONING_REPORT,
    })
    await expect(page.getByText('✓ Uploaded')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Document verified ✓')).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 5 — Date of first operation
    await page.locator('#ob-first-op-date').fill('2020-01-15')
    await page.getByLabel('Document type').selectOption(
      'Project commissioning report approved by the local government',
    )
    await page.getByLabel('Upload document (PDF, JPG, PNG, WEBP — max 20 MB)').setInputFiles({
      name: 'commissioning-report.pdf',
      mimeType: 'application/pdf',
      buffer: COMMISSIONING_REPORT,
    })
    await expect(page.getByText('✓ Uploaded')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Document verified ✓')).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 6 — Equipment photos (no mock; photo errors don't produce warnings)
    await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
      name: 'equipment-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: DUMMY_JPEG,
    })
    await expect(page.getByText('Uploaded')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 7 — Metering photos
    await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
      name: 'meter-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: DUMMY_JPEG,
    })
    await expect(page.getByText('Uploaded')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 8 — Review: warning from gen section
    await expect(page.locator('text=I understand and want to submit anyway')).toBeVisible()

    // Submitting without acknowledgement is blocked
    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByRole('alert')).toBeVisible()

    // Acknowledge and submit
    await page.getByLabel('I understand and want to submit anyway').check()
    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByRole('heading', { name: 'Submission received' })).toBeVisible()

    await assertInDb(page, '[Playwright Test] Wrong Gen Doc')
  })

  // ── Test 3: Capacity verification failure ─────────────────────────────────────
  test('warns when the document does not confirm the stated capacity and requires acknowledgement to submit', async ({ page }) => {
    await setupTestAuth(page, GENERATOR_USER)

    await page.goto('/onboarding', { waitUntil: 'networkidle' })

    // Step 1 — Project info
    await page.locator('#ob-project-name').fill('[Playwright Test] Wrong Cap Doc')
    await page.locator('#ob-project-type').selectOption('Utility')
    await page.locator('#ob-annual-gen').fill('100')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 2 — Generation type: upload commissioning report (passes)
    await page.locator('#ob-gen-type').selectOption('solar')
    await page.getByLabel('Document type').selectOption(
      'Project commissioning report approved by the local government',
    )
    await page.getByLabel('Upload document (PDF, JPG, PNG, WEBP — max 20 MB)').setInputFiles({
      name: 'commissioning-report.pdf',
      mimeType: 'application/pdf',
      buffer: COMMISSIONING_REPORT,
    })
    await expect(page.getByText('✓ Uploaded')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Document verified ✓')).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 3 — Claim 50 kWp but upload a spec sheet showing only 5 Wp (contentMatches: false)
    await page.locator('#ob-capacity').fill('50')
    await page.getByLabel('Document type').selectOption('Equipment purchase and installation contracts')
    await page.getByLabel('Upload document (PDF, JPG, PNG, WEBP — max 20 MB)').setInputFiles({
      name: 'low-capacity-specs.pdf',
      mimeType: 'application/pdf',
      buffer: LOW_CAPACITY_PDF,
    })
    await expect(page.getByText('✓ Uploaded')).toBeVisible({ timeout: 15_000 })
    await assertViewLink(page)
    await waitForMismatch(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Steps 4–5: reuse the commissioning report from step 2.
    // The dropdown shows two labels: "Project commissioning report…" (step 2) and
    // "Equipment purchase and installation contracts" (step 3) — no duplicates,
    // so the label selector is unambiguous.

    // Step 4 — Location
    await page.locator('#ob-lat').fill('-0.12')
    await page.locator('#ob-lon').fill('34.57')
    await page.getByLabel('Reuse a previously uploaded document').selectOption({
      label: 'Project commissioning report approved by the local government',
    })
    await expect(page.getByText('Document verified ✓')).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 5 — Date of first operation
    await page.locator('#ob-first-op-date').fill('2020-01-15')
    await page.getByLabel('Reuse a previously uploaded document').selectOption({
      label: 'Project commissioning report approved by the local government',
    })
    await expect(page.getByText('Document verified ✓')).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 6 — Equipment photos
    await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
      name: 'equipment-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: DUMMY_JPEG,
    })
    await expect(page.getByText('Uploaded')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 7 — Metering photos
    await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
      name: 'meter-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: DUMMY_JPEG,
    })
    await expect(page.getByText('Uploaded')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(300)

    // Step 8 — Review: warning from cap section
    await expect(page.locator('text=I understand and want to submit anyway')).toBeVisible()

    // Blocked without acknowledgement
    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByRole('alert')).toBeVisible()

    // Acknowledge and submit
    await page.getByLabel('I understand and want to submit anyway').check()
    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByRole('heading', { name: 'Submission received' })).toBeVisible()

    await assertInDb(page, '[Playwright Test] Wrong Cap Doc')
  })
})

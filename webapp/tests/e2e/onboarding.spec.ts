import { test, expect, type Page } from '@playwright/test'

const GENERATOR_USER = {
  id: 1,
  username: 'generator',
  email: 'generator@example.com',
  companyWallet: null,
  isGenerator: true,
  isBuyer: false,
  isAdmin: false,
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
// test 1 — it states energy source, capacity, coordinates, and date clearly.
const COMMISSIONING_REPORT = makePdf([
  'PROJECT COMMISSIONING REPORT',
  'Solar Installation - Primary energy source: Solar',
  'Installed capacity: 50 kWp',
  'Site: Latitude -0.12 degrees  Longitude 34.57 degrees',
  'Date of commissioning: January 15  2020',
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

// Dummy JPEG bytes used for photo uploads in test 1. Gemini is mocked for photo
// sections so actual image content is irrelevant; the R2 upload path is still real.
const DUMMY_JPEG = Buffer.alloc(64, 0xff)

// ── Pre-seeded drafts for tests 2 & 3 ─────────────────────────────────────────
// Non-tested sections carry placeholder URLs and passing LLM results so that
// restoreDocResult() sets them to 'done', and goNext() never re-triggers analysis.

const BASE_DRAFT = {
  id: 1,
  status: 'draft',
  projectName: 'Test Solar Farm',
  projectType: 'Utility',
  expectedAnnualGeneration: '100',
  genGenerationType: 'solar',
  genDocUrl:  'https://placeholder.example/gen.pdf',
  genDocType: 'Project commissioning report approved by the local government',
  genSecondarySrc: null, genSecondaryDesc: null,
  genTertiarySrc:  null, genTertiaryDesc:  null,
  genLlmDocTypeMatch: true, genLlmContentMatch: true, genLlmReason: null,
  capCapacity: '50',
  capDocUrl:  'https://placeholder.example/cap.pdf',
  capDocType: 'Equipment purchase and installation contracts',
  capLlmDocTypeMatch: true, capLlmContentMatch: true, capLlmReason: null,
  locPhysicalAddress: null, locLat: -0.12, locLon: 34.57,
  locDocUrl:  'https://placeholder.example/loc.pdf',
  locDocType: 'Land lease/ownership agreements',
  locLlmDocTypeMatch: true, locLlmContentMatch: true, locLlmReason: null,
  dateDateOfFirstOperation: '2020-01-15',
  dateDocUrl:  'https://placeholder.example/date.pdf',
  dateDocType: 'Project commissioning report approved by the local government',
  dateLlmDocTypeMatch: true, dateLlmContentMatch: true, dateLlmReason: null,
  photosGen:  [{ url: 'https://placeholder.example/gen-photo.jpg',   caption: '' }],
  photosGenLlmMatch: true, photosGenLlmReason: null,
  photosMeter: [{ url: 'https://placeholder.example/meter-photo.jpg', caption: '' }],
  photosMeterLlmMatch: true, photosMeterLlmReason: null,
}

// Test 2 draft: gen section has no document so the gen LLM fields are null,
// leaving llmStatus.gen at 'idle' — the test then uploads an invoice to that slot.
const DRAFT_WITHOUT_GEN_DOC = {
  ...BASE_DRAFT,
  uuid: 'mock-uuid-2',
  genDocUrl: null, genDocType: null,
  genLlmDocTypeMatch: null, genLlmContentMatch: null, genLlmReason: null,
}

// Test 3 draft: cap section has no document.
const DRAFT_WITHOUT_CAP_DOC = {
  ...BASE_DRAFT,
  uuid: 'mock-uuid-3',
  capDocUrl: null, capDocType: null,
  capLlmDocTypeMatch: null, capLlmContentMatch: null, capLlmReason: null,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Click "View file ↗" and assert the popup resolves to a presigned R2 URL. */
async function assertViewLink(page: Page) {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByText('View file ↗').click(),
  ])
  await popup.waitForLoadState('domcontentloaded')
  expect(popup.url()).toMatch(/r2\./)
  await popup.close()
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Onboarding — generator project submission', () => {

  // ── Test 1: Happy path ────────────────────────────────────────────────────────
  test('submits a perfect project with all document verifications passing', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-playwright-user': JSON.stringify(GENERATOR_USER) })

    // Form CRUD mocked. R2 and Gemini are real for document sections (steps 2–5).
    // Photo sections (steps 6–7) are mocked so no real equipment photo is required.
    await page.route('/api/onboarding', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ submission: { uuid: 'test-sub-uuid' } }),
      }),
    )
    await page.route('/api/onboarding/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    )
    await page.route('/api/onboarding/analyze', async route => {
      const body = JSON.parse(route.request().postData() ?? '{}') as { section: string }
      if (body.section === 'photosGen' || body.section === 'photosMeter') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ documentTypeMatches: null, contentMatches: true, reasonForFalse: null }),
        })
      }
      return route.continue()
    })

    await page.goto('/onboarding')

    // Step 1 — Project info
    await page.locator('#ob-project-name').fill('Test Solar Farm')
    await page.locator('#ob-project-type').selectOption('Utility')
    await page.locator('#ob-annual-gen').fill('100')
    await page.getByRole('button', { name: 'Continue' }).click()

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

    // Step 6 — Equipment photos: real R2 upload, Gemini mocked
    await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
      name: 'equipment-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: DUMMY_JPEG,
    })
    await expect(page.getByText('Uploaded')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 7 — Metering photos: real R2 upload, Gemini mocked
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
  })

  // ── Test 2: Wrong document type ───────────────────────────────────────────────
  test('warns when a wrong document type is uploaded and requires acknowledgement to submit', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-playwright-user': JSON.stringify(GENERATOR_USER) })

    // Serve a pre-filled draft so only the gen section needs a real upload.
    await page.route('/api/onboarding/mock-uuid-2', async route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ submission: DRAFT_WITHOUT_GEN_DOC }),
        })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })

    await page.goto('/onboarding?id=mock-uuid-2')

    // Step 1 is pre-filled — advance
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 2 — upload an invoice claiming it is a commissioning report
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

    // Gemini should flag the document type as mismatched
    await expect(page.getByText('Document may not match your submission')).toBeVisible({ timeout: 60_000 })

    // Navigate through the remaining pre-filled steps (3–8) to reach Review
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: 'Continue' }).click()
    }

    // Step 8 — warning banner must appear
    await expect(page.locator('text=I understand and want to submit anyway')).toBeVisible()

    // Submitting without acknowledgement is blocked
    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByRole('alert')).toBeVisible()

    // Acknowledge and submit
    await page.getByLabel('I understand and want to submit anyway').check()
    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByRole('heading', { name: 'Submission received' })).toBeVisible()
  })

  // ── Test 3: Capacity verification failure ─────────────────────────────────────
  test('warns when the document does not confirm the stated capacity and requires acknowledgement to submit', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-playwright-user': JSON.stringify(GENERATOR_USER) })

    await page.route('/api/onboarding/mock-uuid-3', async route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ submission: DRAFT_WITHOUT_CAP_DOC }),
        })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })

    await page.goto('/onboarding?id=mock-uuid-3')

    // Steps 1 & 2 are pre-filled — advance past both
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 3 — claim 50 kWp but upload a spec sheet that shows only 5 Wp
    await page.locator('#ob-capacity').fill('50')
    await page.getByLabel('Document type').selectOption('Equipment purchase and installation contracts')
    await page.getByLabel('Upload document (PDF, JPG, PNG, WEBP — max 20 MB)').setInputFiles({
      name: 'low-capacity-specs.pdf',
      mimeType: 'application/pdf',
      buffer: LOW_CAPACITY_PDF,
    })
    await expect(page.getByText('✓ Uploaded')).toBeVisible({ timeout: 15_000 })
    await assertViewLink(page)

    // Gemini should flag the capacity as unverified
    await expect(page.getByText('Document may not match your submission')).toBeVisible({ timeout: 60_000 })

    // Navigate through remaining pre-filled steps to Review
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Continue' }).click()
    }

    // Step 8 — warning banner must appear
    await expect(page.locator('text=I understand and want to submit anyway')).toBeVisible()

    // Blocked without acknowledgement
    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByRole('alert')).toBeVisible()

    // Acknowledge and submit
    await page.getByLabel('I understand and want to submit anyway').check()
    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByRole('heading', { name: 'Submission received' })).toBeVisible()
  })
})

import { test, expect } from '@playwright/test'

// Mock user injected via the X-Playwright-User header.
// server/middleware/test-auth.ts reads this header and:
//   - returns { user } for GET /api/_auth/session (SSR session hydration)
//   - calls setUserSession() for all other requests (API auth guards)
const MOCK_USER = {
  id: 1,
  username: 'testuser',
  email: 'testuser@example.com',
  companyWallet: null,
  isGenerator: false,
  isBuyer: true,
  isAdmin: false,
}

// ── Page appearance ────────────────────────────────────────────────────────────

test('shows the REX wordmark and sign-in form', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Username')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('page title is "Sign in"', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle(/Sign in/)
})

// ── Error handling ─────────────────────────────────────────────────────────────

test('displays an error alert on invalid credentials', async ({ page }) => {
  await page.route('/api/auth/login', route =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 401, statusMessage: 'Invalid credentials' }),
    }),
  )

  await page.goto('/login')
  await page.getByLabel('Username').fill('nobody')
  await page.getByLabel('Password').fill('wrongpassword')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
})

test('submit button shows "Signing in…" while the request is in flight', async ({ page }) => {
  // Use a long delay so the assertion easily catches the loading state before
  // the mock responds and flips loading back to false.
  await page.route('/api/auth/login', async route => {
    await new Promise(resolve => setTimeout(resolve, 3_000))
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 401, statusMessage: 'Invalid credentials' }),
    })
  })

  await page.goto('/login')
  await page.getByLabel('Username').fill('nobody')
  await page.getByLabel('Password').fill('wrong')

  // Click via the role-based locator (matches "Sign in" before submit).
  // Then switch to a type-based locator for the in-flight assertion: once
  // loading=true the button text becomes "Signing in…", which no longer
  // matches the /sign in/i regex (no space between "sign" and "in"),
  // so the role locator would return "element not found".
  const submitButton = page.locator('button[type="submit"]')

  // Do NOT await the click — Playwright waits for in-flight network requests
  // before resolving click(), so awaiting it first would mean loading is already
  // false by the time we check.
  const clickPromise = submitButton.click()
  await expect(submitButton).toHaveText('Signing in…', { timeout: 2_000 })
  await clickPromise
})

// ── Successful login ───────────────────────────────────────────────────────────

test('redirects to /dashboard after successful login', async ({ page }) => {
  // Mock the login endpoint — it only needs to return 200; the session is
  // already handled via the X-Playwright-User header below.
  await page.route('/api/auth/login', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, user: MOCK_USER }),
    }),
  )

  // Load the login page in unauthenticated state so the form is visible.
  await page.goto('/login')

  // Set the auth header AFTER the login page loads so the initial /login SSR
  // does not auto-redirect.  From this point on, all browser requests (and any
  // server-side requests triggered by navigateTo) carry the header, so both
  // the client-side fetchSession() call and any server SSR auth checks succeed.
  await page.setExtraHTTPHeaders({ 'x-playwright-user': JSON.stringify(MOCK_USER) })

  await page.getByLabel('Username').fill('testuser')
  await page.getByLabel('Password').fill('correctpassword')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL('/dashboard')
})

// ── Already-authenticated redirect ────────────────────────────────────────────

test('redirects logged-in users away from /login to /dashboard', async ({ page }) => {
  // Set the header BEFORE loading /login.  The SSR session plugin fetches
  // /api/_auth/session as an internal Nitro subrequest; test-auth.ts intercepts
  // it and returns { user: MOCK_USER }, so the SSR renders with loggedIn = true.
  // auth.global.ts then calls navigateTo('/dashboard') server-side (302).
  await page.setExtraHTTPHeaders({ 'x-playwright-user': JSON.stringify(MOCK_USER) })
  await page.goto('/login')

  await expect(page).toHaveURL('/dashboard')
})

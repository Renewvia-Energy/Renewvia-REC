/**
 * Auth guard tests — verify that route middleware correctly protects pages.
 *
 * Unauthenticated tests: no extra headers; SSR renders with loggedIn = false.
 * Authenticated tests: X-Playwright-User header → server/middleware/test-auth.ts
 *   populates the session so SSR sees the correct user and role flags.
 */
import { test, expect } from '@playwright/test'

// ── Unauthenticated redirects ──────────────────────────────────────────────────
// No API mocks needed; the server has no session cookie → SSR renders with
// loggedIn = false → auth.global.ts issues a server-side 302 to /login.

const PROTECTED_ROUTES = [
  '/dashboard',
  '/dashboard/buyer',
  '/dashboard/generator',
  '/dashboard/admin',
  '/dashboard/admin/orders',
  '/dashboard/admin/onboarding',
  '/dashboard/admin/users',
  '/onboarding',
]

for (const route of PROTECTED_ROUTES) {
  test(`unauthenticated: ${route} → /login`, async ({ page }) => {
    await page.goto(route)
    await expect(page).toHaveURL('/login')
  })
}

// ── Role-based middleware ──────────────────────────────────────────────────────

test('non-buyer authenticated user is redirected away from /dashboard/buyer', async ({ page }) => {
  const generatorUser = {
    id: 2, username: 'generator', email: 'gen@example.com',
    companyWallet: null, isGenerator: true, isBuyer: false, isAdmin: false,
  }

  // The X-Playwright-User header is forwarded to all server requests.
  // test-auth.ts intercepts the internal /api/_auth/session fetch so SSR sees
  // isGenerator=true, isBuyer=false.  middleware/buyer.ts then redirects.
  await page.setExtraHTTPHeaders({ 'x-playwright-user': JSON.stringify(generatorUser) })
  await page.goto('/dashboard/buyer')

  // middleware/buyer.ts redirects non-buyers (who are not admin) to /dashboard
  await expect(page).toHaveURL('/dashboard')
})

test('non-admin authenticated user is redirected away from /dashboard/admin', async ({ page }) => {
  const buyerUser = {
    id: 3, username: 'buyer', email: 'buyer@example.com',
    companyWallet: '0xabc', isGenerator: false, isBuyer: true, isAdmin: false,
  }

  await page.setExtraHTTPHeaders({ 'x-playwright-user': JSON.stringify(buyerUser) })
  await page.goto('/dashboard/admin')

  // middleware/admin.ts redirects non-admins to /dashboard
  await expect(page).toHaveURL('/dashboard')
})

test('admin user can access /dashboard/admin', async ({ page }) => {
  const adminUser = {
    id: 99, username: 'admin', email: 'admin@example.com',
    companyWallet: null, isGenerator: false, isBuyer: false, isAdmin: true,
  }

  await page.setExtraHTTPHeaders({ 'x-playwright-user': JSON.stringify(adminUser) })
  await page.goto('/dashboard/admin')

  // Admin user passes both auth.global.ts and middleware/admin.ts — URL stays
  await expect(page).toHaveURL('/dashboard/admin')
})

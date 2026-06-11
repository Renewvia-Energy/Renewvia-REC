/**
 * Playwright E2E test authentication middleware.
 *
 * ONLY active when PLAYWRIGHT_TEST=true — never enabled in production.
 *
 * Playwright's page.route() intercepts browser-initiated requests, but the
 * nuxt-auth-utils session.server.js SSR plugin calls /api/_auth/session as an
 * internal Nitro subrequest (server-side), which page.route() cannot intercept.
 * This middleware fills that gap.
 *
 * When a request carries the X-Playwright-User header (set via
 * page.setExtraHTTPHeaders), this middleware:
 *
 *   1. If the path is GET /api/_auth/session — returns the mock user JSON
 *      directly, short-circuiting the real session-cookie lookup used by
 *      the SSR session hydration plugin.
 *
 *   2. For all other paths — calls setUserSession() which populates h3's
 *      per-request session cache (event.context._sessionCache).  Subsequent
 *      calls to requireAuth / requireBuyer / requireAdmin on the same request
 *      read from that cache and see the authenticated user, even though no
 *      real session cookie is present.
 */
export default defineEventHandler(async (event) => {
  if (!process.env.PLAYWRIGHT_TEST) return

  const raw = getHeader(event, 'x-playwright-user')
  if (!raw) return

  let user: Record<string, unknown>
  try {
    user = JSON.parse(raw)
  } catch {
    return
  }

  // SSR session hydration: the nuxt-auth-utils session.server.js plugin calls
  // GET /api/_auth/session as an internal Nitro fetch.  Return the mock user
  // directly so the SSR renders with loggedIn = true.
  if (event.path === '/api/_auth/session' && getMethod(event) === 'GET') {
    return { user }
  }

  // For page requests and authenticated API calls: populate h3's per-request
  // session cache so requireUserSession() (and therefore requireAuth, etc.)
  // returns the mock user without needing a real sealed cookie.
  await setUserSession(event, { user })
})

import { eq } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'
import { createPresignedView } from '~/server/utils/r2'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { url } = getQuery(event)
  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'url is required' })
  }

  const config = useRuntimeConfig()
  const publicBase = config.public.r2PublicUrl as string

  if (!url.startsWith(publicBase + '/')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' })
  }

  const key = url.slice(publicBase.length + 1)

  // Non-admins may only view their own uploads.
  if (!user.isAdmin) {
    // New-format keys embed the user id: onboarding/<section>/<userId>/<timestamp>-<filename>
    // Playwright test uploads carry a leading _playwright-tests/ prefix — strip it before checking.
    const keyToCheck = key.replace(/^_playwright-tests\//, '')
    const parts = keyToCheck.split('/')
    const isOwnUpload =
      parts.length === 4 &&
      parts[0] === 'onboarding' &&
      parts[2] === String(user.id)

    if (!isOwnUpload) {
      // Old-format uploads (no user id in path): fall back to DB ownership check
      const db = useDb()
      const submissions = await db
        .select({
          genDocUrl:   schema.onboardingSubmissions.genDocUrl,
          capDocUrl:   schema.onboardingSubmissions.capDocUrl,
          locDocUrl:   schema.onboardingSubmissions.locDocUrl,
          dateDocUrl:  schema.onboardingSubmissions.dateDocUrl,
          photosGen:   schema.onboardingSubmissions.photosGen,
          photosMeter: schema.onboardingSubmissions.photosMeter,
        })
        .from(schema.onboardingSubmissions)
        .where(eq(schema.onboardingSubmissions.userId, user.id))

      const allowed = submissions.some(sub =>
        sub.genDocUrl  === url ||
        sub.capDocUrl  === url ||
        sub.locDocUrl  === url ||
        sub.dateDocUrl === url ||
        sub.photosGen?.some(p => p.url === url) ||
        sub.photosMeter?.some(p => p.url === url),
      )

      if (!allowed) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
      }
    }
  }

  const signedUrl = await createPresignedView(key)
  return sendRedirect(event, signedUrl, 307)
})

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

  // Non-admins may only view documents belonging to their own submissions
  if (!user.isAdmin) {
    const db = useDb()

    const [onboardingSubs, futuresSubs] = await Promise.all([
      db
        .select({
          genDocUrl:   schema.onboardingSubmissions.genDocUrl,
          capDocUrl:   schema.onboardingSubmissions.capDocUrl,
          locDocUrl:   schema.onboardingSubmissions.locDocUrl,
          dateDocUrl:  schema.onboardingSubmissions.dateDocUrl,
          photosGen:   schema.onboardingSubmissions.photosGen,
          photosMeter: schema.onboardingSubmissions.photosMeter,
        })
        .from(schema.onboardingSubmissions)
        .where(eq(schema.onboardingSubmissions.userId, user.id)),
      db
        .select({
          devLicenseDocUrl:       schema.futuresSubmissions.devLicenseDocUrl,
          landRightsDocUrl:       schema.futuresSubmissions.landRightsDocUrl,
          equipProcurementDocUrl: schema.futuresSubmissions.equipProcurementDocUrl,
          projTimelineDocUrl:     schema.futuresSubmissions.projTimelineDocUrl,
          engSpecsDocUrl:         schema.futuresSubmissions.engSpecsDocUrl,
          fundingCommitmentDocUrl:schema.futuresSubmissions.fundingCommitmentDocUrl,
          gridConnectionDocUrl:   schema.futuresSubmissions.gridConnectionDocUrl,
        })
        .from(schema.futuresSubmissions)
        .where(eq(schema.futuresSubmissions.userId, user.id)),
    ])

    const allowedFromOnboarding = onboardingSubs.some(sub =>
      sub.genDocUrl  === url ||
      sub.capDocUrl  === url ||
      sub.locDocUrl  === url ||
      sub.dateDocUrl === url ||
      sub.photosGen?.some(p => p.url === url) ||
      sub.photosMeter?.some(p => p.url === url),
    )
    const allowedFromFutures = futuresSubs.some(sub =>
      sub.devLicenseDocUrl        === url ||
      sub.landRightsDocUrl        === url ||
      sub.equipProcurementDocUrl  === url ||
      sub.projTimelineDocUrl      === url ||
      sub.engSpecsDocUrl          === url ||
      sub.fundingCommitmentDocUrl === url ||
      sub.gridConnectionDocUrl    === url,
    )

    if (!allowedFromOnboarding && !allowedFromFutures) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
  }

  const signedUrl = await createPresignedView(key)
  return sendRedirect(event, signedUrl, 307)
})

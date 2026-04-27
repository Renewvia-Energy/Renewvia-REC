import { eq } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'
import type { NewOnboardingSubmission } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = parseInt(getRouterParam(event, 'id') ?? '')
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const body = await readBody<Partial<NewOnboardingSubmission> & {
    status?: string
    reviewNotes?: string
  }>(event)

  const db = useDb()

  const [existing] = await db
    .select()
    .from(schema.onboardingSubmissions)
    .where(eq(schema.onboardingSubmissions.id, id))
    .limit(1)

  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Submission not found' })

  // Non-admin can only update their own draft submissions
  if (!user.isAdmin) {
    if (existing.userId !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
    if (existing.status !== 'draft') {
      throw createError({ statusCode: 400, statusMessage: 'Only draft submissions can be edited' })
    }
  }

  const updates: Partial<typeof schema.onboardingSubmissions.$inferInsert> = {
    updatedAt: new Date(),
  }

  // Generator can update all form fields
  if (body.projectName              !== undefined) updates.projectName              = body.projectName
  if (body.projectType              !== undefined) updates.projectType              = body.projectType
  if (body.expectedAnnualGeneration !== undefined) updates.expectedAnnualGeneration = body.expectedAnnualGeneration
  if (body.genGenerationType        !== undefined) updates.genGenerationType        = body.genGenerationType
  if (body.genDocUrl                !== undefined) updates.genDocUrl                = body.genDocUrl
  if (body.genDocType               !== undefined) updates.genDocType               = body.genDocType
  if (body.genSecondarySrc          !== undefined) updates.genSecondarySrc          = body.genSecondarySrc
  if (body.genSecondaryDesc         !== undefined) updates.genSecondaryDesc         = body.genSecondaryDesc
  if (body.genTertiarySrc           !== undefined) updates.genTertiarySrc           = body.genTertiarySrc
  if (body.genTertiaryDesc          !== undefined) updates.genTertiaryDesc          = body.genTertiaryDesc
  if (body.capCapacity              !== undefined) updates.capCapacity              = body.capCapacity
  if (body.capDocUrl                !== undefined) updates.capDocUrl                = body.capDocUrl
  if (body.capDocType               !== undefined) updates.capDocType               = body.capDocType
  if (body.locPhysicalAddress       !== undefined) updates.locPhysicalAddress       = body.locPhysicalAddress
  if (body.locLat                   !== undefined) updates.locLat                   = body.locLat
  if (body.locLon                   !== undefined) updates.locLon                   = body.locLon
  if (body.locDocUrl                !== undefined) updates.locDocUrl                = body.locDocUrl
  if (body.locDocType               !== undefined) updates.locDocType               = body.locDocType
  if (body.dateDateOfFirstOperation !== undefined) updates.dateDateOfFirstOperation = body.dateDateOfFirstOperation
  if (body.dateDocUrl               !== undefined) updates.dateDocUrl               = body.dateDocUrl
  if (body.dateDocType              !== undefined) updates.dateDocType              = body.dateDocType
  if (body.photosGen                !== undefined) updates.photosGen                = body.photosGen
  if (body.photosGenLlmMatch        !== undefined) updates.photosGenLlmMatch        = body.photosGenLlmMatch
  if (body.photosGenLlmReason       !== undefined) updates.photosGenLlmReason       = body.photosGenLlmReason
  if (body.photosMeter              !== undefined) updates.photosMeter              = body.photosMeter
  if (body.photosMeterLlmMatch      !== undefined) updates.photosMeterLlmMatch      = body.photosMeterLlmMatch
  if (body.photosMeterLlmReason     !== undefined) updates.photosMeterLlmReason     = body.photosMeterLlmReason
  if (body.genLlmDocTypeMatch       !== undefined) updates.genLlmDocTypeMatch       = body.genLlmDocTypeMatch
  if (body.genLlmContentMatch       !== undefined) updates.genLlmContentMatch       = body.genLlmContentMatch
  if (body.genLlmReason             !== undefined) updates.genLlmReason             = body.genLlmReason
  if (body.capLlmDocTypeMatch       !== undefined) updates.capLlmDocTypeMatch       = body.capLlmDocTypeMatch
  if (body.capLlmContentMatch       !== undefined) updates.capLlmContentMatch       = body.capLlmContentMatch
  if (body.capLlmReason             !== undefined) updates.capLlmReason             = body.capLlmReason
  if (body.locLlmDocTypeMatch       !== undefined) updates.locLlmDocTypeMatch       = body.locLlmDocTypeMatch
  if (body.locLlmContentMatch       !== undefined) updates.locLlmContentMatch       = body.locLlmContentMatch
  if (body.locLlmReason             !== undefined) updates.locLlmReason             = body.locLlmReason
  if (body.dateLlmDocTypeMatch      !== undefined) updates.dateLlmDocTypeMatch      = body.dateLlmDocTypeMatch
  if (body.dateLlmContentMatch      !== undefined) updates.dateLlmContentMatch      = body.dateLlmContentMatch
  if (body.dateLlmReason            !== undefined) updates.dateLlmReason            = body.dateLlmReason

  // Status transition: generator can submit (draft → pending)
  if (body.status === 'pending' && existing.status === 'draft') {
    updates.status = 'pending'
  }

  // Admin can approve/reject (pending only) or re-open a rejected submission
  if (user.isAdmin) {
    if (body.status === 'approved' || body.status === 'rejected') {
      if (existing.status !== 'pending') {
        throw createError({ statusCode: 409, statusMessage: 'Can only approve or reject pending submissions' })
      }
      updates.status     = body.status
      updates.reviewedAt = new Date()
      updates.reviewedBy = user.id
    }
    if (body.status === 'draft' && existing.status === 'rejected') {
      // Re-open a rejected submission so the generator can revise and resubmit
      updates.status = 'draft'
    }
    if (body.reviewNotes !== undefined) {
      updates.reviewNotes = body.reviewNotes
    }
  }

  const [submission] = await db
    .update(schema.onboardingSubmissions)
    .set(updates)
    .where(eq(schema.onboardingSubmissions.id, id))
    .returning()

  return { submission }
})

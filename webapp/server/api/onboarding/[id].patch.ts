import { eq } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'
import type { NewOnboardingSubmission } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const body = await readBody<Partial<NewOnboardingSubmission> & {
    status?: string
    reviewNotes?: string
  }>(event)

  const db = useDb()

  const [existing] = await db
    .select()
    .from(schema.onboardingSubmissions)
    .where(eq(schema.onboardingSubmissions.uuid, id))
    .limit(1)

  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Submission not found' })

  // Non-admin can only update their own submissions
  if (!user.isAdmin) {
    if (existing.userId !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
    // Allow reopen (rejected → draft); otherwise require draft status to edit
    const isReopening = body.status === 'draft' && existing.status === 'rejected'
    if (!isReopening && existing.status !== 'draft') {
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
  if (body.photosMeter              !== undefined) updates.photosMeter              = body.photosMeter
  // LLM result fields are written only by the server-side analyze endpoint; never accepted from the client

  // Status transition: generator can submit (draft → pending) or reopen (rejected → draft)
  if (body.status === 'pending' && existing.status === 'draft') {
    updates.status = 'pending'
  }
  if (!user.isAdmin && body.status === 'draft' && existing.status === 'rejected') {
    updates.status = 'draft'
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
      updates.status     = 'draft'
      updates.reviewedAt = null
      updates.reviewedBy = null
    }
    if (body.reviewNotes !== undefined) {
      updates.reviewNotes = body.reviewNotes
    }
  }

  const [submission] = await db
    .update(schema.onboardingSubmissions)
    .set(updates)
    .where(eq(schema.onboardingSubmissions.uuid, id))
    .returning()

  return { submission }
})

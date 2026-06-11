import { eq } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'
import type { NewFuturesSubmission } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const body = await readBody<Partial<NewFuturesSubmission> & {
    status?: string
    reviewNotes?: string
  }>(event)

  const db = useDb()

  const [existing] = await db
    .select()
    .from(schema.futuresSubmissions)
    .where(eq(schema.futuresSubmissions.uuid, id))
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

  const updates: Partial<typeof schema.futuresSubmissions.$inferInsert> = {
    updatedAt: new Date(),
  }

  // Generator can update all form fields
  if (body.projectName              !== undefined) updates.projectName              = body.projectName
  if (body.projectType              !== undefined) updates.projectType              = body.projectType
  if (body.expectedAnnualGeneration !== undefined) updates.expectedAnnualGeneration = body.expectedAnnualGeneration
  if (body.expectedCompletionDate   !== undefined) updates.expectedCompletionDate   = body.expectedCompletionDate
  if (body.devLicenseDocUrl         !== undefined) updates.devLicenseDocUrl         = body.devLicenseDocUrl
  if (body.devLicenseDocType        !== undefined) updates.devLicenseDocType        = body.devLicenseDocType
  if (body.landRightsDocUrl         !== undefined) updates.landRightsDocUrl         = body.landRightsDocUrl
  if (body.landRightsDocType        !== undefined) updates.landRightsDocType        = body.landRightsDocType
  if (body.equipProcurementDocUrl   !== undefined) updates.equipProcurementDocUrl   = body.equipProcurementDocUrl
  if (body.equipProcurementDocType  !== undefined) updates.equipProcurementDocType  = body.equipProcurementDocType
  if (body.projTimelineDocUrl       !== undefined) updates.projTimelineDocUrl       = body.projTimelineDocUrl
  if (body.projTimelineDocType      !== undefined) updates.projTimelineDocType      = body.projTimelineDocType
  if (body.engSpecsDocUrl           !== undefined) updates.engSpecsDocUrl           = body.engSpecsDocUrl
  if (body.engSpecsDocType          !== undefined) updates.engSpecsDocType          = body.engSpecsDocType
  if (body.fundingCommitmentDocUrl  !== undefined) updates.fundingCommitmentDocUrl  = body.fundingCommitmentDocUrl
  if (body.fundingCommitmentDocType !== undefined) updates.fundingCommitmentDocType = body.fundingCommitmentDocType
  if (body.gridConnectionDocUrl     !== undefined) updates.gridConnectionDocUrl     = body.gridConnectionDocUrl
  if (body.gridConnectionDocType    !== undefined) updates.gridConnectionDocType    = body.gridConnectionDocType
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
    .update(schema.futuresSubmissions)
    .set(updates)
    .where(eq(schema.futuresSubmissions.uuid, id))
    .returning()

  return { submission }
})

import { requireGenerator } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'
import type { NewFuturesSubmission } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireGenerator(event)
  const body = await readBody<Partial<NewFuturesSubmission> & { status?: string }>(event)

  const db = useDb()
  const [submission] = await db
    .insert(schema.futuresSubmissions)
    .values({
      userId:                   user.id,
      status:                   body.status === 'pending' ? 'pending' : 'draft',
      projectName:              body.projectName,
      projectType:              body.projectType,
      expectedAnnualGeneration: body.expectedAnnualGeneration,
      expectedCompletionDate:   body.expectedCompletionDate,
      devLicenseDocUrl:         body.devLicenseDocUrl,
      devLicenseDocType:        body.devLicenseDocType,
      landRightsDocUrl:         body.landRightsDocUrl,
      landRightsDocType:        body.landRightsDocType,
      equipProcurementDocUrl:   body.equipProcurementDocUrl,
      equipProcurementDocType:  body.equipProcurementDocType,
      projTimelineDocUrl:       body.projTimelineDocUrl,
      projTimelineDocType:      body.projTimelineDocType,
      engSpecsDocUrl:           body.engSpecsDocUrl,
      engSpecsDocType:          body.engSpecsDocType,
      fundingCommitmentDocUrl:  body.fundingCommitmentDocUrl,
      fundingCommitmentDocType: body.fundingCommitmentDocType,
      gridConnectionDocUrl:     body.gridConnectionDocUrl,
      gridConnectionDocType:    body.gridConnectionDocType,
      // LLM result fields are written only by the server-side analyze endpoint; never accepted from the client
    })
    .returning()

  return { submission }
})

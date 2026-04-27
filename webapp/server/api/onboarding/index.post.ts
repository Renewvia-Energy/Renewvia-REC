import { requireGenerator } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'
import type { NewOnboardingSubmission } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireGenerator(event)
  const body = await readBody<Partial<NewOnboardingSubmission> & { status?: string }>(event)

  const db = useDb()
  const [submission] = await db
    .insert(schema.onboardingSubmissions)
    .values({
      userId:                   user.id,
      status:                   body.status === 'pending' ? 'pending' : 'draft',
      projectName:              body.projectName,
      projectType:              body.projectType,
      expectedAnnualGeneration: body.expectedAnnualGeneration,
      genGenerationType:        body.genGenerationType,
      genDocUrl:                body.genDocUrl,
      genDocType:               body.genDocType,
      genSecondarySrc:          body.genSecondarySrc,
      genSecondaryDesc:         body.genSecondaryDesc,
      genTertiarySrc:           body.genTertiarySrc,
      genTertiaryDesc:          body.genTertiaryDesc,
      capCapacity:              body.capCapacity,
      capDocUrl:                body.capDocUrl,
      capDocType:               body.capDocType,
      locPhysicalAddress:       body.locPhysicalAddress,
      locLat:                   body.locLat,
      locLon:                   body.locLon,
      locDocUrl:                body.locDocUrl,
      locDocType:               body.locDocType,
      dateDateOfFirstOperation: body.dateDateOfFirstOperation,
      dateDocUrl:               body.dateDocUrl,
      dateDocType:              body.dateDocType,
      photosGen:                body.photosGen,
      photosGenLlmMatch:        body.photosGenLlmMatch,
      photosGenLlmReason:       body.photosGenLlmReason,
      photosMeter:              body.photosMeter,
      photosMeterLlmMatch:      body.photosMeterLlmMatch,
      photosMeterLlmReason:     body.photosMeterLlmReason,
      genLlmDocTypeMatch:       body.genLlmDocTypeMatch,
      genLlmContentMatch:       body.genLlmContentMatch,
      genLlmReason:             body.genLlmReason,
      capLlmDocTypeMatch:       body.capLlmDocTypeMatch,
      capLlmContentMatch:       body.capLlmContentMatch,
      capLlmReason:             body.capLlmReason,
      locLlmDocTypeMatch:       body.locLlmDocTypeMatch,
      locLlmContentMatch:       body.locLlmContentMatch,
      locLlmReason:             body.locLlmReason,
      dateLlmDocTypeMatch:      body.dateLlmDocTypeMatch,
      dateLlmContentMatch:      body.dateLlmContentMatch,
      dateLlmReason:            body.dateLlmReason,
    })
    .returning()

  return { submission }
})

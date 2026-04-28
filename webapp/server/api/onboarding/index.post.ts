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
      photosMeter:              body.photosMeter,
      // LLM result fields are written only by the server-side analyze endpoint; never accepted from the client
    })
    .returning()

  return { submission }
})

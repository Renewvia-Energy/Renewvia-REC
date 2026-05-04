import { eq } from 'drizzle-orm'
import { requireGenerator } from '~/server/utils/auth'
import { createPresignedView } from '~/server/utils/r2'
import { analyzeDocument, type LlmResult } from '~/server/utils/gemini'
import { useDb, schema } from '~/server/db'

type Section =
  | 'devLicense'
  | 'landRights'
  | 'equipProcurement'
  | 'projTimeline'
  | 'engSpecs'
  | 'fundingCommitment'
  | 'gridConnection'

interface AnalyzeBody {
  section: Section
  urls: string[]
  submissionId?: string
}

/** Extract the R2 object key from a public URL by stripping the public base URL. */
function keyFromPublicUrl(publicUrl: string, r2PublicUrl: string): string {
  const base = r2PublicUrl.replace(/\/$/, '')
  return publicUrl.replace(base + '/', '')
}

/** Infer MIME type from URL extension. */
function mimeFromUrl(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':  return 'application/pdf'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'png':  return 'image/png'
    case 'webp': return 'image/webp'
    default:     return 'application/octet-stream'
  }
}

/** Fetch a document from R2 via a presigned GET URL, returning its bytes. */
async function fetchDocBytes(publicUrl: string, r2PublicUrl: string): Promise<ArrayBuffer> {
  const key = keyFromPublicUrl(publicUrl, r2PublicUrl)
  const presignedUrl = await createPresignedView(key)
  const res = await fetch(presignedUrl)
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: 'Failed to fetch document from storage' })
  return res.arrayBuffer()
}

// Descriptions from the R-REC Standard, Sale of Future Generation chapter.
const SECTION_DESCRIPTIONS: Record<Section, string> = {
  devLicense:        'a municipal building permit, environmental clearance certificate, or equivalent regulatory approval specific to renewable energy development or legal reference if no such regulatory requirement exists',
  landRights:        'a property deed, land lease agreement of sufficient duration, or land use rights certificate covering the project area',
  equipProcurement:  'equipment supplier quotations, memorandum of understanding with suppliers, or conditional purchase agreements for major components (e.g., solar panels, wind turbines, inverters) from recognized manufacturers',
  projTimeline:      'an implementation schedule showing key milestones and expected commissioning date within 18 months',
  engSpecs:          'a technical summary document showing projected capacity, technology type, and basic system design parameters',
  fundingCommitment: 'a bank commitment letter, term sheet, investment agreement, or evidence of available capital covering at least 70% of total project costs',
  gridConnection:    'a grid connection agreement or utility letter of intent',
}

/** Build the DB update fields for a given section and LLM result. */
function buildLlmUpdate(section: Section, result: LlmResult): Partial<typeof schema.futuresSubmissions.$inferInsert> {
  switch (section) {
    case 'devLicense':
      return { devLicenseLlmMatch: result.contentMatches, devLicenseLlmReason: result.reasonForFalse }
    case 'landRights':
      return { landRightsLlmMatch: result.contentMatches, landRightsLlmReason: result.reasonForFalse }
    case 'equipProcurement':
      return { equipProcurementLlmMatch: result.contentMatches, equipProcurementLlmReason: result.reasonForFalse }
    case 'projTimeline':
      return { projTimelineLlmMatch: result.contentMatches, projTimelineLlmReason: result.reasonForFalse }
    case 'engSpecs':
      return { engSpecsLlmMatch: result.contentMatches, engSpecsLlmReason: result.reasonForFalse }
    case 'fundingCommitment':
      return { fundingCommitmentLlmMatch: result.contentMatches, fundingCommitmentLlmReason: result.reasonForFalse }
    case 'gridConnection':
      return { gridConnectionLlmMatch: result.contentMatches, gridConnectionLlmReason: result.reasonForFalse }
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireGenerator(event)

  const body = await readBody<AnalyzeBody>(event)

  if (!body.section || !body.urls?.length) {
    throw createError({ statusCode: 400, statusMessage: 'section and urls are required' })
  }

  if (body.urls.length > 1) {
    throw createError({ statusCode: 400, statusMessage: 'Only one URL may be analyzed at a time' })
  }

  const description = SECTION_DESCRIPTIONS[body.section]
  if (!description) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown section' })
  }

  const r2PublicUrl = (useRuntimeConfig().public.r2PublicUrl as string).replace(/\/$/, '')

  if (!r2PublicUrl) {
    throw createError({ statusCode: 500, statusMessage: 'R2 public URL not configured' })
  }

  for (const url of body.urls) {
    if (!url.startsWith(r2PublicUrl + '/')) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid document URL' })
    }
  }

  // Single content prompt per the R-REC Standard; no document-type prompt
  const contentPrompt = `True or false, does this document upload fit the following description: ${description}`

  const bytes    = await fetchDocBytes(body.urls[0], r2PublicUrl)
  const mimeType = mimeFromUrl(body.urls[0])

  let result: Awaited<ReturnType<typeof analyzeDocument>>
  try {
    result = await analyzeDocument(bytes, mimeType, null, contentPrompt)
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500
    throw createError({ statusCode: status, statusMessage: status === 503 || status === 429
      ? 'Verification service temporarily unavailable. Please try again.'
      : 'Document verification failed',
    })
  }

  // Persist the result to the submission so the admin review reflects server-verified data
  if (body.submissionId) {
    const db = useDb()
    const [existing] = await db
      .select({ id: schema.futuresSubmissions.id, userId: schema.futuresSubmissions.userId })
      .from(schema.futuresSubmissions)
      .where(eq(schema.futuresSubmissions.uuid, body.submissionId))
      .limit(1)

    if (existing && existing.userId === user.id) {
      await db
        .update(schema.futuresSubmissions)
        .set(buildLlmUpdate(body.section, result))
        .where(eq(schema.futuresSubmissions.uuid, body.submissionId))
    }
  }

  return result
})

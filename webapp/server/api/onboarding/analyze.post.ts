import { eq } from 'drizzle-orm'
import { requireGenerator } from '~/server/utils/auth'
import { createPresignedView } from '~/server/utils/r2'
import { analyzeDocument, type LlmResult } from '~/server/utils/gemini'
import { useDb, schema } from '~/server/db'

type Section = 'gen' | 'cap' | 'loc' | 'date' | 'photosGen' | 'photosMeter'

interface AnalyzeBody {
  section: Section
  urls: string[]
  submissionId?: string
  // Document-type sections only:
  docType?: string
  // Section-specific context:
  genGenerationType?: string
  capCapacity?: number
  locAddress?: string
  locLat?: number
  locLon?: number
  date?: string
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

/** Build the two Gemini prompts for a given section. */
function buildPrompts(body: AnalyzeBody): { docTypePrompt: string | null; contentPrompt: string } {
  switch (body.section) {
    case 'gen':
      return {
        docTypePrompt: `True or false: this is a ${body.docType}`,
        contentPrompt: `True or false: this indicates that the primary energy source is ${body.genGenerationType}`,
      }
    case 'cap':
      return {
        docTypePrompt: `True or false: this is a ${body.docType}`,
        contentPrompt: `True or false: this indicates that the installed capacity is ${body.capCapacity} kWp`,
      }
    case 'loc': {
      const locationClause = body.locAddress
        ? `located either at ${body.locAddress} or coordinates ${body.locLat} degrees latitude, ${body.locLon} degrees longitude`
        : `located at coordinates ${body.locLat} degrees latitude, ${body.locLon} degrees longitude`
      return {
        docTypePrompt: `True or false: this is a ${body.docType}`,
        contentPrompt: `True or false: this indicates that the project is ${locationClause}`,
      }
    }
    case 'date':
      return {
        docTypePrompt: `True or false: this is a ${body.docType}`,
        contentPrompt: `True or false: this indicates that the project was installed on ${body.date}. If the document only gives a month and year, at least those two match ${body.date}.`,
      }
    case 'photosGen':
      return {
        docTypePrompt: null,
        contentPrompt: 'True or false: this is a photo of renewable energy generation equipment, e.g., solar panels or wind turbines',
      }
    case 'photosMeter':
      return {
        docTypePrompt: null,
        contentPrompt: 'True or false: this is a photo of electricity metering or monitoring equipment, e.g., a smart meter, inverter display, or data logger',
      }
  }
}

/** Build the DB update fields for a given section and LLM result. */
function buildLlmUpdate(section: Section, result: LlmResult): Partial<typeof schema.onboardingSubmissions.$inferInsert> {
  switch (section) {
    case 'gen':
      return { genLlmDocTypeMatch: result.documentTypeMatches, genLlmContentMatch: result.contentMatches, genLlmReason: result.reasonForFalse }
    case 'cap':
      return { capLlmDocTypeMatch: result.documentTypeMatches, capLlmContentMatch: result.contentMatches, capLlmReason: result.reasonForFalse }
    case 'loc':
      return { locLlmDocTypeMatch: result.documentTypeMatches, locLlmContentMatch: result.contentMatches, locLlmReason: result.reasonForFalse }
    case 'date':
      return { dateLlmDocTypeMatch: result.documentTypeMatches, dateLlmContentMatch: result.contentMatches, dateLlmReason: result.reasonForFalse }
    case 'photosGen':
      return { photosGenLlmMatch: result.contentMatches, photosGenLlmReason: result.reasonForFalse }
    case 'photosMeter':
      return { photosMeterLlmMatch: result.contentMatches, photosMeterLlmReason: result.reasonForFalse }
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

  const r2PublicUrl = (useRuntimeConfig().public.r2PublicUrl as string).replace(/\/$/, '')

  if (!r2PublicUrl) {
    throw createError({ statusCode: 500, statusMessage: 'R2 public URL not configured' })
  }

  for (const url of body.urls) {
    if (!url.startsWith(r2PublicUrl + '/')) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid document URL' })
    }
  }

  const { docTypePrompt, contentPrompt } = buildPrompts(body)

  const bytes    = await fetchDocBytes(body.urls[0], r2PublicUrl)
  const mimeType = mimeFromUrl(body.urls[0])

  let result: Awaited<ReturnType<typeof analyzeDocument>>
  try {
    result = await analyzeDocument(bytes, mimeType, docTypePrompt, contentPrompt)
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
      .select({ id: schema.onboardingSubmissions.id, userId: schema.onboardingSubmissions.userId })
      .from(schema.onboardingSubmissions)
      .where(eq(schema.onboardingSubmissions.uuid, body.submissionId))
      .limit(1)

    if (existing && existing.userId === user.id) {
      await db
        .update(schema.onboardingSubmissions)
        .set(buildLlmUpdate(body.section, result))
        .where(eq(schema.onboardingSubmissions.uuid, body.submissionId))
    }
  }

  return result
})

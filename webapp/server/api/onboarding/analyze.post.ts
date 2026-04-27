import { requireGenerator } from '~/server/utils/auth'
import { createPresignedView } from '~/server/utils/r2'
import { analyzeDocument, type LlmResult } from '~/server/utils/gemini'

type Section = 'gen' | 'cap' | 'loc' | 'date' | 'photosGen' | 'photosMeter'

interface AnalyzeBody {
  section: Section
  urls: string[]
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
    case 'photosMeter':
      return {
        docTypePrompt: null,
        contentPrompt: 'True or false: this is a photo of renewable energy generation equipment',
      }
  }
}

/** Aggregate multiple photo results: pass only if all pass. */
function aggregateResults(results: LlmResult[]): LlmResult {
  const failing = results.find(r => !r.contentMatches)
  if (failing) return failing
  return { documentTypeMatches: null, contentMatches: true, reasonForFalse: null }
}

export default defineEventHandler(async (event) => {
  await requireGenerator(event)

  const body = await readBody<AnalyzeBody>(event)

  if (!body.section || !body.urls?.length) {
    throw createError({ statusCode: 400, statusMessage: 'section and urls are required' })
  }

  const r2PublicUrl = useRuntimeConfig().public.r2PublicUrl as string
  const { docTypePrompt, contentPrompt } = buildPrompts(body)

  // For photos: analyze all in parallel and aggregate. For docs: just one URL.
  const results = await Promise.all(
    body.urls.map(async (url) => {
      const bytes    = await fetchDocBytes(url, r2PublicUrl)
      const mimeType = mimeFromUrl(url)
      return analyzeDocument(bytes, mimeType, docTypePrompt, contentPrompt)
    }),
  )

  const result: LlmResult = results.length === 1 ? results[0] : aggregateResults(results)

  return result
})

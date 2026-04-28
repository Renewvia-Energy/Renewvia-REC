import { GoogleGenAI } from '@google/genai'

export interface LlmResult {
  /** null for photo sections which have no document-type prompt */
  documentTypeMatches: boolean | null
  contentMatches: boolean
  reasonForFalse: string | null
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    documentTypeMatches: { type: 'boolean', nullable: true },
    contentMatches:      { type: 'boolean' },
    reasonForFalse:      { type: 'string',  nullable: true },
  },
  required: ['documentTypeMatches', 'contentMatches', 'reasonForFalse'],
}

const SYSTEM_INSTRUCTION =
  'You are a document verifier for a renewable energy certificate (REC) registry. ' +
  'Analyze the provided document or photo and answer the verification questions honestly. ' +
  'Be lenient: only mark false if the document clearly contradicts or is entirely unrelated to the claim.'

/**
 * Analyze a single document/image with Gemini.
 *
 * @param docBytes    Raw bytes of the document fetched from R2.
 * @param mimeType    MIME type (e.g. 'application/pdf', 'image/jpeg').
 * @param docTypePrompt  Question about document type, or null for photo sections.
 * @param contentPrompt  Question about the document's content.
 */
// Status codes worth retrying — all transient capacity/overload responses.
const RETRYABLE_STATUSES = new Set([429, 500, 503])
const RETRY_DELAYS_MS    = [1_000, 2_000, 4_000]

export async function analyzeDocument(
  docBytes: ArrayBuffer,
  mimeType: string,
  docTypePrompt: string | null,
  contentPrompt: string,
): Promise<LlmResult> {
  const config = useRuntimeConfig()
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey as string })
  const model = config.geminiModel as string

  const promptText = docTypePrompt
    ? `Question 1: ${docTypePrompt} Answer as documentTypeMatches.\nQuestion 2: ${contentPrompt} Answer as contentMatches.`
    : `Question: ${contentPrompt} Answer as contentMatches. Set documentTypeMatches to null.`

  const request = {
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: promptText },
          { inlineData: { mimeType, data: Buffer.from(docBytes).toString('base64') } },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_SCHEMA,
    },
  }

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await ai.models.generateContent(request)
      try {
        return JSON.parse(response.text ?? '{}') as LlmResult
      } catch {
        return { documentTypeMatches: null, contentMatches: false, reasonForFalse: 'Could not analyze document' }
      }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status && RETRYABLE_STATUSES.has(status) && attempt < RETRY_DELAYS_MS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]))
        continue
      }
      throw err
    }
  }

  // Unreachable, but satisfies TypeScript.
  throw new Error('analyzeDocument: exhausted retries')
}

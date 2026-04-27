/**
 * Diagnostic endpoint for Gemini LLM verification.
 * Admin-only. DELETE THIS FILE before deploying to production.
 *
 * Usage:
 *   GET /api/debug/llm-check
 *   GET /api/debug/llm-check?docUrl=<public-R2-url>
 *
 * Returns a JSON report testing each layer of the pipeline.
 */

import { requireAdmin } from '~/server/utils/auth'
import { createPresignedView } from '~/server/utils/r2'
import { GoogleGenAI } from '@google/genai'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query     = getQuery(event)
  const docUrl    = query.docUrl as string | undefined
  const config    = useRuntimeConfig()
  const r2Base    = (config.public.r2PublicUrl as string).replace(/\/$/, '')

  const report: Record<string, unknown> = {}

  // ── 1. Gemini API key ────────────────────────────────────────────────────────
  const apiKey = config.geminiApiKey as string | undefined
  report.geminiKeySet = !!apiKey && apiKey.length > 0

  // ── 2. Gemini model reachable (text-only ping, no document) ─────────────────
  if (report.geminiKeySet) {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey! })
      const res = await ai.models.generateContent({
        model: config.geminiModel as string,
        contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
      })
      report.geminiModelReachable = true
      report.geminiPingResponse   = res.text?.trim()
    } catch (err: unknown) {
      report.geminiModelReachable = false
      report.geminiModelError     = err instanceof Error ? err.message : String(err)
    }
  } else {
    report.geminiModelReachable = 'skipped — no API key'
  }

  // ── 3. R2 key extraction from public URL ─────────────────────────────────────
  if (docUrl) {
    const startsWithBase = docUrl.startsWith(r2Base + '/')
    const extractedKey   = startsWithBase ? docUrl.slice(r2Base.length + 1) : null
    report.r2PublicUrlBase   = r2Base
    report.r2KeyExtracted    = extractedKey
    report.r2KeyExtractionOk = !!extractedKey

    // ── 4. R2 presigned GET URL + fetch ─────────────────────────────────────────
    if (extractedKey) {
      try {
        const presignedUrl = await createPresignedView(extractedKey)
        report.r2PresignedUrlGenerated = true

        const fetchRes = await fetch(presignedUrl)
        report.r2FetchStatus = fetchRes.status
        report.r2FetchOk     = fetchRes.ok

        if (fetchRes.ok) {
          const bytes = await fetchRes.arrayBuffer()
          report.r2DocumentBytes = bytes.byteLength

          // ── 5. Full Gemini call with the real document ─────────────────────────
          if (report.geminiModelReachable === true) {
            try {
              const ai = new GoogleGenAI({ apiKey: apiKey! })
              const ext = docUrl.split('?')[0].split('.').pop()?.toLowerCase()
              const mimeType = ext === 'pdf' ? 'application/pdf'
                : ext === 'png'  ? 'image/png'
                : ext === 'webp' ? 'image/webp'
                : 'image/jpeg'

              const res = await ai.models.generateContent({
                model: config.geminiModel as string,
                contents: [{
                  role: 'user',
                  parts: [
                    { text: 'In one sentence, describe what this document or image shows.' },
                    { inlineData: { mimeType, data: Buffer.from(bytes).toString('base64') } },
                  ],
                }],
              })
              report.geminiDocumentAnalysisOk  = true
              report.geminiDocumentDescription = res.text?.trim()
            } catch (err: unknown) {
              report.geminiDocumentAnalysisOk    = false
              report.geminiDocumentAnalysisError = err instanceof Error ? err.message : String(err)
            }
          }
        }
      } catch (err: unknown) {
        report.r2PresignedUrlGenerated = false
        report.r2Error = err instanceof Error ? err.message : String(err)
      }
    }
  } else {
    report.r2Note = 'Pass ?docUrl=<public-R2-url> to test R2 fetch and full document analysis'
  }

  return report
})

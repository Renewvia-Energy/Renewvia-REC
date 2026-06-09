import { requireAuth } from '~/server/utils/auth'
import { createPresignedUpload } from '~/server/utils/r2'

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

const ALLOWED_FOLDERS = new Set([
  'onboarding/generation-type',
  'onboarding/capacity',
  'onboarding/location',
  'onboarding/date-of-first-operation',
  'onboarding/equipment-photos',
  'onboarding/metering-photos',
  'futures/dev-license',
  'futures/land-rights',
  'futures/equip-procurement',
  'futures/proj-timeline',
  'futures/eng-specs',
  'futures/funding-commitment',
  'futures/grid-connection',
])

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody<{
    filename: string
    contentType: string
    folder: string
  }>(event)

  if (!body?.filename || !body?.contentType || !body?.folder) {
    throw createError({ statusCode: 400, statusMessage: 'filename, contentType, and folder are required' })
  }

  if (!ALLOWED_CONTENT_TYPES.has(body.contentType)) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported file type' })
  }

  if (!ALLOWED_FOLDERS.has(body.folder)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid upload folder' })
  }

  const folder = process.env.PLAYWRIGHT_TEST === 'true'
    ? `_playwright-tests/${body.folder}`
    : body.folder
  const result = await createPresignedUpload(folder, body.filename, body.contentType, user.id)
  return result
})

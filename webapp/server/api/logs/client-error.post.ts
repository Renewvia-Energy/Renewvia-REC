// Intentionally unauthenticated — this endpoint receives crash reports from
// the browser error handler, which fires for both logged-in and logged-out
// sessions (including errors on the /login page itself). Do not add requireAuth.
import { logger } from '~/server/utils/logger'

interface ClientErrorBody {
  type:       'vue' | 'unhandledrejection'
  route?:     string
  userId?:    number
  username?:  string
  error:      { message: string; stack?: string; name: string }
  vueInfo?:   string
  userAgent?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ClientErrorBody>(event)
  const ip   = getRequestIP(event, { xForwardedFor: true })

  logger.error({
    source:    'client',
    type:      body.type,
    route:     body.route,
    userId:    body.userId,
    username:  body.username,
    err:       body.error,
    vueInfo:   body.vueInfo,
    userAgent: body.userAgent,
    ip,
  }, `Client error on ${body.route ?? 'unknown route'}: ${body.error?.message}`)

  return { ok: true }
})

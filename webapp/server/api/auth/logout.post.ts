import { logger } from '~/server/utils/logger'
import type { SessionUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user    = session?.user as SessionUser | undefined

  await clearUserSession(event)

  if (user) {
    logger.info({
      userId:   user.id,
      username: user.username,
      ip:       getRequestIP(event, { xForwardedFor: true }),
    }, 'Logout')
  }

  return { ok: true }
})

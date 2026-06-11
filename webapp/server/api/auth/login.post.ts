import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { useDb, schema } from '~/server/db'
import { logger } from '~/server/utils/logger'
import type { SessionUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string }>(event)
  const ip   = getRequestIP(event, { xForwardedFor: true })

  if (!body?.username || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: 'Username and password required' })
  }

  const username = body.username.trim().toLowerCase()
  const db = useDb()

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1)

  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    logger.warn({ username, ip }, 'Login failed: invalid credentials')
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const sessionUser: SessionUser = {
    id:            user.id,
    username:      user.username,
    email:         user.email,
    companyWallet: user.companyWallet,
    isGenerator:   user.isGenerator,
    isBuyer:       user.isBuyer,
    isAdmin:       user.isAdmin,
  }

  await setUserSession(event, { user: sessionUser })

  logger.info({ userId: user.id, username: user.username, ip }, 'Login success')
  return { ok: true, user: sessionUser }
})

import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '~/server/utils/auth'
import { logger } from '~/server/utils/logger'
import { useDb, schema } from '~/server/db'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const id = parseInt(getRouterParam(event, 'id') ?? '')
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const body = await readBody<{
    username?: string
    isGenerator?: boolean
    isBuyer?: boolean
    isAdmin?: boolean
    companyWallet?: string
    password?: string
  }>(event)

  const updates: Partial<typeof schema.users.$inferInsert> = {}

  if (body.username !== undefined) updates.username = body.username.trim().toLowerCase()
  if (body.isGenerator !== undefined) updates.isGenerator = body.isGenerator
  if (body.isBuyer !== undefined) updates.isBuyer = body.isBuyer
  if (body.isAdmin !== undefined) updates.isAdmin = body.isAdmin
  if (body.companyWallet !== undefined) updates.companyWallet = body.companyWallet ? body.companyWallet.toLowerCase() : null
  if (body.password) {
    if (body.password.length < 12) {
      throw createError({ statusCode: 400, statusMessage: 'Password must be at least 12 characters' })
    }
    updates.passwordHash = await bcrypt.hash(body.password, 12)
  }

  const db = useDb()
  const [user] = await db
    .update(schema.users)
    .set(updates)
    .where(eq(schema.users.id, id))
    .returning({
      id:            schema.users.id,
      username:      schema.users.username,
      email:         schema.users.email,
      isGenerator:   schema.users.isGenerator,
      isBuyer:       schema.users.isBuyer,
      isAdmin:       schema.users.isAdmin,
      companyWallet: schema.users.companyWallet,
    })

  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  logger.info({
    adminId:        admin.id,
    targetUserId:   id,
    targetUsername: user.username,
    changes:        Object.keys(updates).filter(k => k !== 'passwordHash'),
  }, 'User updated by admin')

  return { user }
})

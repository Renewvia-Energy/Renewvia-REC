import bcrypt from 'bcryptjs'
import { requireAdmin } from '~/server/utils/auth'
import { logger } from '~/server/utils/logger'
import { useDb, schema } from '~/server/db'

interface CreateUserBody {
  username: string
  email: string
  password: string
  isGenerator: boolean
  isBuyer: boolean
  isAdmin: boolean
  companyWallet?: string
}

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody<CreateUserBody>(event)

  if (!body?.username?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Username is required' })
  }
  if (!body?.email || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }
  if (body.password.length < 12) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 12 characters' })
  }

  const passwordHash = await bcrypt.hash(body.password, 12)
  const db = useDb()

  let user
  try {
    ;[user] = await db
      .insert(schema.users)
      .values({
        username:      body.username.trim().toLowerCase(),
        email:         body.email.toLowerCase().trim(),
        passwordHash,
        isGenerator:   body.isGenerator ?? false,
        isBuyer:       body.isBuyer ?? false,
        isAdmin:       body.isAdmin ?? false,
        companyWallet: body.companyWallet?.toLowerCase() ?? null,
        createdBy:     admin.id,
      })
      .returning({
        id:            schema.users.id,
        username:      schema.users.username,
        email:         schema.users.email,
        isGenerator:   schema.users.isGenerator,
        isBuyer:       schema.users.isBuyer,
        isAdmin:       schema.users.isAdmin,
        companyWallet: schema.users.companyWallet,
        createdAt:     schema.users.createdAt,
      })
  } catch (e: unknown) {
    // Postgres unique-constraint violation
    if ((e as { code?: string })?.code === '23505') {
      logger.warn({ adminId: admin.id, username: body.username.trim().toLowerCase() }, 'User creation failed: username taken')
      throw createError({ statusCode: 409, statusMessage: 'Username already taken — choose a different one' })
    }
    throw e
  }

  logger.info({
    adminId:     admin.id,
    newUserId:   user!.id,
    newUsername: user!.username,
    roles:       { isGenerator: user!.isGenerator, isBuyer: user!.isBuyer, isAdmin: user!.isAdmin },
  }, 'User created')

  return { user }
})

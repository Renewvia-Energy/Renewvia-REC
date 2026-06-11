import { eq, and } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  if (!user.companyWallet) throw createError({ statusCode: 400, statusMessage: 'No company wallet' })

  const db = useDb()

  // Non-admin can only delete their own company's goals
  const condition = user.isAdmin
    ? eq(schema.goals.uuid, id)
    : and(eq(schema.goals.uuid, id), eq(schema.goals.companyWallet, user.companyWallet))

  const [deleted] = await db
    .delete(schema.goals)
    .where(condition)
    .returning({ id: schema.goals.id })

  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Goal not found' })
  return { ok: true }
})

import { eq } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  if (!user.companyWallet) return { goals: [] }

  const db = useDb()
  const goals = await db
    .select()
    .from(schema.goals)
    .where(eq(schema.goals.companyWallet, user.companyWallet))
    .orderBy(schema.goals.scope, schema.goals.createdAt)

  return { goals }
})

import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDb()

  const { all } = getQuery(event)
  const showAll = user.isAdmin && all === 'true'

  const rows = showAll
    ? await db
        .select()
        .from(schema.futuresSubmissions)
        .orderBy(desc(schema.futuresSubmissions.createdAt))
    : await db
        .select()
        .from(schema.futuresSubmissions)
        .where(eq(schema.futuresSubmissions.userId, user.id))
        .orderBy(desc(schema.futuresSubmissions.createdAt))

  return { submissions: rows }
})

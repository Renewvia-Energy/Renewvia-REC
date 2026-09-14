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
        .select({ submission: schema.onboardingSubmissions, username: schema.users.username })
        .from(schema.onboardingSubmissions)
        .leftJoin(schema.users, eq(schema.onboardingSubmissions.userId, schema.users.id))
        .orderBy(desc(schema.onboardingSubmissions.createdAt))
    : await db
        .select({ submission: schema.onboardingSubmissions, username: schema.users.username })
        .from(schema.onboardingSubmissions)
        .leftJoin(schema.users, eq(schema.onboardingSubmissions.userId, schema.users.id))
        .where(eq(schema.onboardingSubmissions.userId, user.id))
        .orderBy(desc(schema.onboardingSubmissions.createdAt))

  return { submissions: rows.map(r => ({ ...r.submission, username: r.username })) }
})

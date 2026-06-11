import { eq } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const db = useDb()
  const [submission] = await db
    .select()
    .from(schema.futuresSubmissions)
    .where(eq(schema.futuresSubmissions.uuid, id))
    .limit(1)

  if (!submission) throw createError({ statusCode: 404, statusMessage: 'Submission not found' })

  if (!user.isAdmin && submission.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return { submission }
})

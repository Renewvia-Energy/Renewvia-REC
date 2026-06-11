import { requireBuyer } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'

export default defineEventHandler(async (event) => {
  const user = await requireBuyer(event)
  const body = await readBody<{
    scope: 0 | 1 | 2 | 3
    targetMwh?: number
    targetTco2e?: number
    description?: string
    targetYear?: number
  }>(event)

  if (![0, 1, 2, 3].includes(body?.scope)) {
    throw createError({ statusCode: 400, statusMessage: 'scope must be 0, 1, 2, or 3' })
  }

  if (!user.companyWallet) {
    throw createError({ statusCode: 400, statusMessage: 'Account not linked to a company wallet' })
  }

  const db = useDb()
  const [goal] = await db
    .insert(schema.goals)
    .values({
      companyWallet: user.companyWallet,
      scope:         body.scope,
      targetMwh:     body.targetMwh?.toString(),
      targetTco2e:   body.targetTco2e?.toString(),
      description:   body.description,
      targetYear:    body.targetYear,
    })
    .returning()

  return { goal }
})

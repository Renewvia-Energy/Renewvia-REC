import { requireAdmin } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useDb()
  const users = await db
    .select({
      id:            schema.users.id,
      username:      schema.users.username,
      email:         schema.users.email,
      isGenerator:   schema.users.isGenerator,
      isBuyer:       schema.users.isBuyer,
      isAdmin:       schema.users.isAdmin,
      companyWallet: schema.users.companyWallet,
      createdAt:     schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(schema.users.createdAt)

  return { users }
})

import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { useDb, schema } from '~/server/db'

export default defineEventHandler(async (event) => {
  const user  = await requireAuth(event)
  const db    = useDb()
  const query = getQuery(event)

  const q = db
    .select({
      id:              schema.orders.id,
      userId:          schema.orders.userId,
      companyWallet:   schema.orders.companyWallet,
      contractAddress: schema.orders.contractAddress,
      contractName:    schema.orders.contractName,
      abbreviation:    schema.orders.abbreviation,
      side:            schema.orders.side,
      orderType:       schema.orders.orderType,
      amount:          schema.orders.amount,
      limitPrice:      schema.orders.limitPrice,
      stopPrice:       schema.orders.stopPrice,
      notes:           schema.orders.notes,
      status:          schema.orders.status,
      createdAt:       schema.orders.createdAt,
      processedAt:     schema.orders.processedAt,
      processingNotes: schema.orders.processingNotes,
    })
    .from(schema.orders)

  // Admins can fetch all orders with ?all=true; otherwise filter to own orders
  const rows = user.isAdmin && query.all === 'true'
    ? await q.orderBy(desc(schema.orders.createdAt))
    : await q.where(eq(schema.orders.userId, user.id)).orderBy(desc(schema.orders.createdAt))

  return { orders: rows }
})

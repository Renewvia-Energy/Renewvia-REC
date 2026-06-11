import { eq } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { logger } from '~/server/utils/logger'
import { useDb, schema } from '~/server/db'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const body = await readBody<{
    status?: 'cancelled' | 'executed'
    processingNotes?: string
  }>(event)

  const db = useDb()

  // Fetch the existing order
  const [existing] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.uuid, id))
    .limit(1)

  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Order not found' })

  // Finalized orders cannot be re-transitioned
  if (existing.status === 'executed' || existing.status === 'cancelled') {
    throw createError({ statusCode: 409, statusMessage: 'Order is already finalized' })
  }

  // Non-admin can only cancel their own orders
  if (!user.isAdmin) {
    if (existing.userId !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
    if (body.status && body.status !== 'cancelled') {
      throw createError({ statusCode: 403, statusMessage: 'You can only cancel orders' })
    }
  }

  const updates: Partial<typeof schema.orders.$inferInsert> = {}

  if (body.status) {
    updates.status = body.status
    if (body.status === 'executed' || body.status === 'cancelled') {
      updates.processedAt = new Date()
      if (user.isAdmin) updates.processedBy = user.id
    }
  }

  if (user.isAdmin && body.processingNotes !== undefined) {
    updates.processingNotes = body.processingNotes
  }

  const [order] = await db
    .update(schema.orders)
    .set(updates)
    .where(eq(schema.orders.uuid, id))
    .returning()

  if (body.status) {
    logger.info({
      orderId:        id,
      actorId:        user.id,
      actorUsername:  user.username,
      previousStatus: existing.status,
      newStatus:      body.status,
    }, `Order ${id} status changed: ${existing.status} → ${body.status} by ${user.username}`)
  }

  return { order }
})

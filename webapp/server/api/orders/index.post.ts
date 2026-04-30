import { requireBuyer } from '~/server/utils/auth'
import { logger } from '~/server/utils/logger'
import { useDb, schema } from '~/server/db'

interface CreateOrderBody {
  contractAddress?: string
  contractName?: string
  abbreviation?: string
  side: 'buy' | 'sell' | 'retire'
  orderType?: 'market' | 'limit' | 'stop' | 'stop-limit'
  amount: number
  limitPrice?: number
  stopPrice?: number
  notes?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireBuyer(event)
  const body = await readBody<CreateOrderBody>(event)

  if (!body?.side || !body?.amount) {
    throw createError({ statusCode: 400, statusMessage: 'side and amount are required' })
  }

  if (!['buy', 'sell', 'retire'].includes(body.side)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid side' })
  }

  if (body.side === 'retire') {
    if (!body.contractAddress) {
      throw createError({ statusCode: 400, statusMessage: 'contractAddress is required for retire orders' })
    }
  } else {
    if (!body.orderType) {
      throw createError({ statusCode: 400, statusMessage: 'orderType is required for buy and sell orders' })
    }
    if (!['market', 'limit', 'stop', 'stop-limit'].includes(body.orderType)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid orderType' })
    }
  }

  if (!Number.isInteger(body.amount) || body.amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Amount must be a positive integer' })
  }

  if (!user.companyWallet) {
    throw createError({ statusCode: 400, statusMessage: 'Account not linked to a company wallet' })
  }

  const db = useDb()
  const [order] = await db
    .insert(schema.orders)
    .values({
      userId:          user.id,
      companyWallet:   user.companyWallet,
      contractAddress: body.contractAddress,
      contractName:    body.contractName,
      abbreviation:    body.abbreviation,
      side:            body.side,
      orderType:       body.side === 'retire' ? 'n/a' : body.orderType!,
      amount:          body.amount,
      limitPrice:      body.limitPrice?.toString(),
      stopPrice:       body.stopPrice?.toString(),
      notes:           body.notes,
      status:          'pending',
    })
    .returning()

  logger.info({
    orderId:      order.id,
    userId:       user.id,
    username:     user.username,
    side:         order.side,
    orderType:    order.orderType,
    amount:       order.amount,
    abbreviation: order.abbreviation ?? null,
    limitPrice:   order.limitPrice ?? null,
    stopPrice:    order.stopPrice ?? null,
  }, 'Order placed')

  return { order }
})

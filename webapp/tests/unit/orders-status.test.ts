/**
 * Tests for PATCH /api/orders/[id] — the order status-machine.
 *
 * Key rules under test:
 *  - Invalid / non-numeric id → 400
 *  - Order not found → 404
 *  - Finalized order (executed or cancelled) cannot be re-transitioned → 409
 *  - Non-admin cannot touch another user's order → 403
 *  - Non-admin cannot execute (only cancel) → 403
 *  - Buyer can cancel their own pending order → 200
 *  - Admin can execute any pending order → 200
 *  - Admin's id is recorded as processedBy on execute/cancel
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

// ---------------------------------------------------------------------------
// Module mocks (hoisted above imports by Vitest)
// ---------------------------------------------------------------------------
vi.mock('~/server/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('~/server/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}))

const { mockDb } = vi.hoisted(() => {
  const mockDb = { select: vi.fn(), update: vi.fn() }
  return { mockDb }
})

vi.mock('~/server/db', () => ({
  useDb: () => mockDb,
  schema: { orders: { id: 'orders_id', userId: 'orders_userId', status: 'orders_status' } },
}))

// ---------------------------------------------------------------------------
// Imports (resolved after mocks are in place)
// ---------------------------------------------------------------------------
import { requireAuth } from '~/server/utils/auth'
import handler from '~/server/api/orders/[id].patch'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockEvent = {} as H3Event
const mockReadBody = globalThis.readBody as ReturnType<typeof vi.fn>
const mockGetRouterParam = globalThis.getRouterParam as ReturnType<typeof vi.fn>

function makeUser(overrides = {}) {
  return {
    id: 1, username: 'alice', email: 'alice@example.com',
    companyWallet: '0xabc', isGenerator: false, isBuyer: true, isAdmin: false,
    ...overrides,
  }
}

function makeOrder(overrides = {}) {
  return {
    id: 1, userId: 1, status: 'pending',
    companyWallet: '0xabc', side: 'buy', orderType: 'market', amount: 10,
    processedAt: null, processedBy: null, processingNotes: null,
    ...overrides,
  }
}

function setupSelect(order: object | null) {
  const chain = {
    from:  vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(order ? [order] : []),
  }
  mockDb.select.mockReturnValue(chain)
  return chain
}

function setupUpdate(result: object) {
  const chain = {
    set:       vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([result]),
  }
  mockDb.update.mockReturnValue(chain)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// ID validation
// ---------------------------------------------------------------------------
describe('PATCH /api/orders/[id] — id validation', () => {
  it('throws 400 for a missing id', async () => {
    vi.mocked(requireAuth).mockResolvedValue(makeUser())
    mockGetRouterParam.mockReturnValue('')
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })
})

// ---------------------------------------------------------------------------
// Order lookup
// ---------------------------------------------------------------------------
describe('PATCH /api/orders/[id] — order lookup', () => {
  it('throws 404 when the order does not exist', async () => {
    vi.mocked(requireAuth).mockResolvedValue(makeUser({ isAdmin: true }))
    mockGetRouterParam.mockReturnValue('99')
    mockReadBody.mockResolvedValue({ status: 'cancelled' })
    setupSelect(null)
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ---------------------------------------------------------------------------
// Finalized-order guard
// ---------------------------------------------------------------------------
describe('PATCH /api/orders/[id] — finalized-order guard', () => {
  it('throws 409 when the order is already executed', async () => {
    vi.mocked(requireAuth).mockResolvedValue(makeUser({ isAdmin: true }))
    mockGetRouterParam.mockReturnValue('1')
    mockReadBody.mockResolvedValue({ status: 'cancelled' })
    setupSelect(makeOrder({ status: 'executed' }))
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('throws 409 when the order is already cancelled', async () => {
    vi.mocked(requireAuth).mockResolvedValue(makeUser({ isAdmin: true }))
    mockGetRouterParam.mockReturnValue('1')
    mockReadBody.mockResolvedValue({ status: 'executed' })
    setupSelect(makeOrder({ status: 'cancelled' }))
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 409 })
  })
})

// ---------------------------------------------------------------------------
// Non-admin permission checks
// ---------------------------------------------------------------------------
describe("PATCH /api/orders/[id] — non-admin permissions", () => {
  it("throws 403 when a non-admin tries to update another user's order", async () => {
    vi.mocked(requireAuth).mockResolvedValue(makeUser({ id: 2 }))  // user 2
    mockGetRouterParam.mockReturnValue('1')
    mockReadBody.mockResolvedValue({ status: 'cancelled' })
    setupSelect(makeOrder({ userId: 1 }))  // order belongs to user 1
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('throws 403 when a non-admin tries to execute an order', async () => {
    vi.mocked(requireAuth).mockResolvedValue(makeUser({ id: 1, isBuyer: true }))
    mockGetRouterParam.mockReturnValue('1')
    mockReadBody.mockResolvedValue({ status: 'executed' })
    setupSelect(makeOrder({ userId: 1 }))
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })
})

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------
describe('PATCH /api/orders/[id] — happy paths', () => {
  it('allows a buyer to cancel their own pending order', async () => {
    vi.mocked(requireAuth).mockResolvedValue(makeUser({ id: 1, isBuyer: true }))
    mockGetRouterParam.mockReturnValue('1')
    mockReadBody.mockResolvedValue({ status: 'cancelled' })
    setupSelect(makeOrder({ userId: 1 }))
    const updatedOrder = makeOrder({ status: 'cancelled' })
    setupUpdate(updatedOrder)
    const result = await handler(mockEvent)
    expect(result.order.status).toBe('cancelled')
  })

  it('allows an admin to execute any pending order', async () => {
    vi.mocked(requireAuth).mockResolvedValue(makeUser({ id: 99, isAdmin: true }))
    mockGetRouterParam.mockReturnValue('1')
    mockReadBody.mockResolvedValue({ status: 'executed' })
    setupSelect(makeOrder({ userId: 1 }))
    const updatedOrder = makeOrder({ status: 'executed', processedBy: 99 })
    setupUpdate(updatedOrder)
    const result = await handler(mockEvent)
    expect(result.order.status).toBe('executed')
  })

  it('allows an admin to cancel any pending order', async () => {
    vi.mocked(requireAuth).mockResolvedValue(makeUser({ id: 99, isAdmin: true }))
    mockGetRouterParam.mockReturnValue('1')
    mockReadBody.mockResolvedValue({ status: 'cancelled' })
    setupSelect(makeOrder({ userId: 5 }))  // different user's order
    const updatedOrder = makeOrder({ status: 'cancelled', processedBy: 99 })
    setupUpdate(updatedOrder)
    const result = await handler(mockEvent)
    expect(result.order.status).toBe('cancelled')
  })
})

// ---------------------------------------------------------------------------
// processedBy assignment
// ---------------------------------------------------------------------------
describe('PATCH /api/orders/[id] — processedBy', () => {
  it('sets processedBy to admin.id when the admin executes an order', async () => {
    const admin = makeUser({ id: 99, isAdmin: true })
    vi.mocked(requireAuth).mockResolvedValue(admin)
    mockGetRouterParam.mockReturnValue('1')
    mockReadBody.mockResolvedValue({ status: 'executed' })
    setupSelect(makeOrder({ userId: 1 }))
    const updateChain = setupUpdate(makeOrder({ status: 'executed', processedBy: 99 }))
    await handler(mockEvent)
    const setArg = updateChain.set.mock.calls[0][0]
    expect(setArg.processedBy).toBe(99)
  })

  it('sets processedBy to admin.id when the admin cancels an order', async () => {
    const admin = makeUser({ id: 42, isAdmin: true })
    vi.mocked(requireAuth).mockResolvedValue(admin)
    mockGetRouterParam.mockReturnValue('1')
    mockReadBody.mockResolvedValue({ status: 'cancelled' })
    setupSelect(makeOrder({ userId: 1 }))
    const updateChain = setupUpdate(makeOrder({ status: 'cancelled', processedBy: 42 }))
    await handler(mockEvent)
    const setArg = updateChain.set.mock.calls[0][0]
    expect(setArg.processedBy).toBe(42)
  })

  it('does not set processedBy when a non-admin cancels their own order', async () => {
    vi.mocked(requireAuth).mockResolvedValue(makeUser({ id: 1, isBuyer: true }))
    mockGetRouterParam.mockReturnValue('1')
    mockReadBody.mockResolvedValue({ status: 'cancelled' })
    setupSelect(makeOrder({ userId: 1 }))
    const updateChain = setupUpdate(makeOrder({ status: 'cancelled' }))
    await handler(mockEvent)
    const setArg = updateChain.set.mock.calls[0][0]
    expect(setArg.processedBy).toBeUndefined()
  })
})

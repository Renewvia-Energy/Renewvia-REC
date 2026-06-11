/**
 * Tests for POST /api/orders — input validation and wallet check.
 *
 * The handler is exercised directly by importing it after vi.mock() has
 * replaced its dependencies. defineEventHandler is stubbed in tests/setup.ts
 * to the identity function, so the default export is the raw async handler.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

// ---------------------------------------------------------------------------
// Module mocks (hoisted above imports by Vitest)
// ---------------------------------------------------------------------------
vi.mock('~/server/utils/auth', () => ({
  requireBuyer: vi.fn(),
}))

vi.mock('~/server/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Minimal DB mock — only the insert chain is needed for this handler.
const { mockDb } = vi.hoisted(() => {
  const mockDb = { insert: vi.fn() }
  return { mockDb }
})

vi.mock('~/server/db', () => ({
  useDb: () => mockDb,
  schema: { orders: {} },
}))

// ---------------------------------------------------------------------------
// Imports (resolved after mocks are in place)
// ---------------------------------------------------------------------------
import { requireBuyer } from '~/server/utils/auth'
import handler from '~/server/api/orders/index.post'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockEvent = {} as H3Event
const mockReadBody = globalThis.readBody as ReturnType<typeof vi.fn>

function makeUser(overrides = {}) {
  return {
    id: 1, username: 'buyer', email: 'buyer@example.com',
    companyWallet: '0xabc123', isGenerator: false, isBuyer: true, isAdmin: false,
    ...overrides,
  }
}

/** Set up the insert chain to resolve with the provided order. */
function setupDbInsert(order: object) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([order]),
  }
  mockDb.insert.mockReturnValue(chain)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireBuyer).mockResolvedValue(makeUser())
})

// ---------------------------------------------------------------------------
// Required field validation
// ---------------------------------------------------------------------------
describe('POST /api/orders — required fields', () => {
  it('throws 400 when side is missing', async () => {
    mockReadBody.mockResolvedValue({ orderType: 'market', amount: 5 })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when orderType is missing', async () => {
    mockReadBody.mockResolvedValue({ side: 'buy', amount: 5 })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when amount is missing', async () => {
    mockReadBody.mockResolvedValue({ side: 'buy', orderType: 'market' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })
})

// ---------------------------------------------------------------------------
// Value validation
// ---------------------------------------------------------------------------
describe('POST /api/orders — value validation', () => {
  it('throws 400 for an invalid side value', async () => {
    mockReadBody.mockResolvedValue({ side: 'hold', orderType: 'market', amount: 10 })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 for an invalid orderType value', async () => {
    mockReadBody.mockResolvedValue({ side: 'buy', orderType: 'futures', amount: 10 })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 for a zero amount', async () => {
    mockReadBody.mockResolvedValue({ side: 'buy', orderType: 'market', amount: 0 })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 for a negative amount', async () => {
    mockReadBody.mockResolvedValue({ side: 'buy', orderType: 'market', amount: -3 })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 for a non-integer amount', async () => {
    mockReadBody.mockResolvedValue({ side: 'buy', orderType: 'market', amount: 2.5 })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })
})

// ---------------------------------------------------------------------------
// Wallet check
// ---------------------------------------------------------------------------
describe('POST /api/orders — wallet check', () => {
  it('throws 400 when the user has no companyWallet', async () => {
    vi.mocked(requireBuyer).mockResolvedValue(makeUser({ companyWallet: null }))
    mockReadBody.mockResolvedValue({ side: 'buy', orderType: 'market', amount: 10 })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })
})

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------
describe('POST /api/orders — success', () => {
  it('returns the created order on valid input', async () => {
    const order = {
      id: 42, userId: 1, companyWallet: '0xabc123',
      side: 'buy', orderType: 'market', amount: 10, status: 'pending',
    }
    setupDbInsert(order)
    mockReadBody.mockResolvedValue({ side: 'buy', orderType: 'market', amount: 10 })
    const result = await handler(mockEvent)
    expect(result).toEqual({ order })
  })

  it('accepts all valid order types', async () => {
    for (const orderType of ['market', 'limit', 'stop', 'stop-limit']) {
      vi.clearAllMocks()
      vi.mocked(requireBuyer).mockResolvedValue(makeUser())
      setupDbInsert({ id: 1, side: 'buy', orderType, amount: 5, status: 'pending' })
      mockReadBody.mockResolvedValue({ side: 'buy', orderType, amount: 5 })
      await expect(handler(mockEvent)).resolves.toHaveProperty('order')
    }
  })

  it('accepts both sides (buy and sell)', async () => {
    for (const side of ['buy', 'sell']) {
      vi.clearAllMocks()
      vi.mocked(requireBuyer).mockResolvedValue(makeUser())
      setupDbInsert({ id: 1, side, orderType: 'market', amount: 5, status: 'pending' })
      mockReadBody.mockResolvedValue({ side, orderType: 'market', amount: 5 })
      await expect(handler(mockEvent)).resolves.toHaveProperty('order')
    }
  })
})

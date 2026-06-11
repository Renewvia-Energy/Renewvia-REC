import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { requireAuth, requireAdmin, requireBuyer, requireGenerator } from '~/server/utils/auth'

// requireUserSession is a Nuxt auto-import stubbed in tests/setup.ts.
const mockRequireUserSession = globalThis.requireUserSession as ReturnType<typeof vi.fn>

const mockEvent = {} as H3Event

function makeUser(overrides: Partial<{
  id: number; username: string; email: string; companyWallet: string | null;
  isGenerator: boolean; isBuyer: boolean; isAdmin: boolean;
}> = {}) {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    companyWallet: null,
    isGenerator: false,
    isBuyer: false,
    isAdmin: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------
describe('requireAuth', () => {
  it('returns the session user when authenticated', async () => {
    const user = makeUser()
    mockRequireUserSession.mockResolvedValue({ user })
    await expect(requireAuth(mockEvent)).resolves.toEqual(user)
  })

  it('propagates the 401 thrown by requireUserSession when unauthenticated', async () => {
    mockRequireUserSession.mockRejectedValue(createError({ statusCode: 401 }))
    await expect(requireAuth(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })
})

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------
describe('requireAdmin', () => {
  it('returns the user when isAdmin is true', async () => {
    const user = makeUser({ isAdmin: true })
    mockRequireUserSession.mockResolvedValue({ user })
    await expect(requireAdmin(mockEvent)).resolves.toEqual(user)
  })

  it('throws 403 when the authenticated user is not an admin', async () => {
    const user = makeUser({ isAdmin: false, isBuyer: true })
    mockRequireUserSession.mockResolvedValue({ user })
    await expect(requireAdmin(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('propagates 401 from requireUserSession when unauthenticated', async () => {
    mockRequireUserSession.mockRejectedValue(createError({ statusCode: 401 }))
    await expect(requireAdmin(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })
})

// ---------------------------------------------------------------------------
// requireGenerator
// ---------------------------------------------------------------------------
describe('requireGenerator', () => {
  it('allows a generator-role user', async () => {
    const user = makeUser({ isGenerator: true })
    mockRequireUserSession.mockResolvedValue({ user })
    await expect(requireGenerator(mockEvent)).resolves.toEqual(user)
  })

  it('allows an admin to bypass the generator role check', async () => {
    const user = makeUser({ isAdmin: true })
    mockRequireUserSession.mockResolvedValue({ user })
    await expect(requireGenerator(mockEvent)).resolves.toEqual(user)
  })

  it('throws 403 when the user has neither generator nor admin role', async () => {
    const user = makeUser({ isBuyer: true })
    mockRequireUserSession.mockResolvedValue({ user })
    await expect(requireGenerator(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })
})

// ---------------------------------------------------------------------------
// requireBuyer
// ---------------------------------------------------------------------------
describe('requireBuyer', () => {
  it('allows a buyer-role user', async () => {
    const user = makeUser({ isBuyer: true })
    mockRequireUserSession.mockResolvedValue({ user })
    await expect(requireBuyer(mockEvent)).resolves.toEqual(user)
  })

  it('allows an admin to bypass the buyer role check', async () => {
    const user = makeUser({ isAdmin: true })
    mockRequireUserSession.mockResolvedValue({ user })
    await expect(requireBuyer(mockEvent)).resolves.toEqual(user)
  })

  it('throws 403 when the user has neither buyer nor admin role', async () => {
    const user = makeUser({ isGenerator: true })
    mockRequireUserSession.mockResolvedValue({ user })
    await expect(requireBuyer(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })
})

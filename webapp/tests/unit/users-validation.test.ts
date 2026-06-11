/**
 * Tests for POST /api/users — admin-only user creation.
 *
 * Validates:
 *  - Blank username → 400
 *  - Missing email or password → 400
 *  - Password shorter than 12 characters → 400
 *  - Duplicate username (Postgres error code 23505) → 409
 *  - Success: returned user omits passwordHash, includes expected fields
 *  - Usernames and emails are lowercased and trimmed before insert
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('~/server/utils/auth', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('~/server/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// bcryptjs is slow; mock it so tests run fast.
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (pw: string) => `hashed:${pw}`),
  },
}))

const { mockDb } = vi.hoisted(() => {
  const mockDb = { insert: vi.fn() }
  return { mockDb }
})

vi.mock('~/server/db', () => ({
  useDb: () => mockDb,
  schema: { users: {} },
}))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { requireAdmin } from '~/server/utils/auth'
import handler from '~/server/api/users/index.post'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockEvent = {} as H3Event
const mockReadBody = globalThis.readBody as ReturnType<typeof vi.fn>

function makeAdmin(overrides = {}) {
  return {
    id: 10, username: 'admin', email: 'admin@example.com',
    companyWallet: null, isGenerator: false, isBuyer: false, isAdmin: true,
    ...overrides,
  }
}

function validBody(overrides = {}) {
  return {
    username: 'newuser',
    email: 'new@example.com',
    password: 'SuperSecret123!',
    isGenerator: false,
    isBuyer: true,
    isAdmin: false,
    ...overrides,
  }
}

function setupDbInsert(result: object) {
  const chain = {
    values:     vi.fn().mockReturnThis(),
    returning:  vi.fn().mockResolvedValue([result]),
  }
  mockDb.insert.mockReturnValue(chain)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockResolvedValue(makeAdmin())
})

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
describe('POST /api/users — input validation', () => {
  it('throws 400 when username is blank', async () => {
    mockReadBody.mockResolvedValue(validBody({ username: '   ' }))
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when email is missing', async () => {
    mockReadBody.mockResolvedValue(validBody({ email: '' }))
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when password is missing', async () => {
    mockReadBody.mockResolvedValue(validBody({ password: '' }))
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when password is shorter than 12 characters', async () => {
    mockReadBody.mockResolvedValue(validBody({ password: 'short' }))
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 for a password that is exactly 11 characters', async () => {
    mockReadBody.mockResolvedValue(validBody({ password: '12345678901' }))
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 400 })
  })
})

// ---------------------------------------------------------------------------
// Duplicate username
// ---------------------------------------------------------------------------
describe('POST /api/users — duplicate username', () => {
  it('throws 409 when the DB raises a unique-constraint violation (code 23505)', async () => {
    mockReadBody.mockResolvedValue(validBody())
    const chain = {
      values:    vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue({ code: '23505' }),
    }
    mockDb.insert.mockReturnValue(chain)
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('re-throws non-constraint errors as-is', async () => {
    mockReadBody.mockResolvedValue(validBody())
    const unexpectedError = new Error('Connection timeout')
    const chain = {
      values:    vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(unexpectedError),
    }
    mockDb.insert.mockReturnValue(chain)
    await expect(handler(mockEvent)).rejects.toThrow('Connection timeout')
  })
})

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------
describe('POST /api/users — success', () => {
  it('returns the created user (without passwordHash)', async () => {
    const createdUser = {
      id: 5, username: 'newuser', email: 'new@example.com',
      isGenerator: false, isBuyer: true, isAdmin: false,
      companyWallet: null, createdAt: new Date(),
    }
    setupDbInsert(createdUser)
    mockReadBody.mockResolvedValue(validBody())
    const result = await handler(mockEvent)
    expect(result).toEqual({ user: createdUser })
    expect(result.user).not.toHaveProperty('passwordHash')
  })

  it('accepts a 12-character password (boundary)', async () => {
    setupDbInsert({ id: 6, username: 'u', email: 'u@u.com', isGenerator: false, isBuyer: false, isAdmin: false, companyWallet: null, createdAt: new Date() })
    mockReadBody.mockResolvedValue(validBody({ password: '123456789012' }))
    await expect(handler(mockEvent)).resolves.toHaveProperty('user')
  })

  it('lowercases and trims the username before inserting', async () => {
    const chain = setupDbInsert({ id: 7, username: 'trimmed', email: 'x@x.com', isGenerator: false, isBuyer: false, isAdmin: false, companyWallet: null, createdAt: new Date() })
    mockReadBody.mockResolvedValue(validBody({ username: '  TrimMed  ' }))
    await handler(mockEvent)
    const insertedValues = chain.values.mock.calls[0][0]
    expect(insertedValues.username).toBe('trimmed')
  })

  it('lowercases and trims the email before inserting', async () => {
    const chain = setupDbInsert({ id: 8, username: 'u2', email: 'user@example.com', isGenerator: false, isBuyer: false, isAdmin: false, companyWallet: null, createdAt: new Date() })
    mockReadBody.mockResolvedValue(validBody({ email: '  User@Example.COM  ' }))
    await handler(mockEvent)
    const insertedValues = chain.values.mock.calls[0][0]
    expect(insertedValues.email).toBe('user@example.com')
  })

  it('records createdBy as the admin id', async () => {
    const chain = setupDbInsert({ id: 9, username: 'u3', email: 'u3@u.com', isGenerator: false, isBuyer: false, isAdmin: false, companyWallet: null, createdAt: new Date() })
    mockReadBody.mockResolvedValue(validBody())
    await handler(mockEvent)
    const insertedValues = chain.values.mock.calls[0][0]
    expect(insertedValues.createdBy).toBe(10)  // makeAdmin().id
  })
})

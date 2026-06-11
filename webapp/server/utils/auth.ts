import type { H3Event } from 'h3'

export interface SessionUser {
  id: number
  username: string
  email: string
  companyWallet: string | null
  isGenerator: boolean
  isBuyer: boolean
  isAdmin: boolean
}

/**
 * Require a valid session — throws 401 if unauthenticated.
 * Returns the typed session user.
 */
export async function requireAuth(event: H3Event): Promise<SessionUser> {
  const session = await requireUserSession(event)
  return session.user as SessionUser
}

/**
 * Require admin role — throws 401/403 if unauthenticated or not admin.
 */
export async function requireAdmin(event: H3Event): Promise<SessionUser> {
  const user = await requireAuth(event)
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return user
}

/**
 * Require generator role.
 */
export async function requireGenerator(event: H3Event): Promise<SessionUser> {
  const user = await requireAuth(event)
  if (!user.isGenerator && !user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return user
}

/**
 * Require buyer role.
 */
export async function requireBuyer(event: H3Event): Promise<SessionUser> {
  const user = await requireAuth(event)
  if (!user.isBuyer && !user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return user
}

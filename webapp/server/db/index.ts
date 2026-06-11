import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Use neon() HTTP driver — works in Vercel serverless without WebSocket setup
// For connection pooling with Neon, use the pooled connection string
// (?pgbouncer=true&sslmode=require at end of DATABASE_URL)

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function useDb() {
  if (_db) return _db

  const config = useRuntimeConfig()
  const url = config.databaseUrl

  if (!url) {
    throw new Error('DATABASE_URL is not configured')
  }

  const sql = neon(url)
  _db = drizzle(sql, { schema })
  return _db
}

export { schema }

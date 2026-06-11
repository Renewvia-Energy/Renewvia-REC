import pino from 'pino'
import { Axiom } from '@axiomhq/js'

export const axiomClient =
  process.env.AXIOM_DATASET && process.env.AXIOM_TOKEN
    ? new Axiom({ token: process.env.AXIOM_TOKEN })
    : null

// pino.transport() uses worker threads, which aren't resolvable in Vercel's
// serverless bundle. Instead, write directly to Axiom via their JS SDK.
const dest = axiomClient
  ? {
      write(msg: string) {
        try {
          axiomClient.ingest(process.env.AXIOM_DATASET!, [JSON.parse(msg)])
        } catch {}
      },
    }
  : undefined

export const logger = pino({ level: 'info' }, dest)

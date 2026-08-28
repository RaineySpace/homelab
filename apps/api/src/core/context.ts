import type { Db } from './database/client.js'
import type { Env } from '../env.js'
import type { RequestIdentity } from './permissions.js'

export type CommandSource = 'manual' | 'agent' | 'import'

export type AppScope = {
  db: Db
  env: Env
}

export type CommandContext = {
  identity: RequestIdentity
  source: CommandSource
  idempotencyKey?: string
  agentRunId?: string
  requestId: string
}

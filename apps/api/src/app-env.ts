import type { Db } from './core/database/client.js'
import type { Env } from './env.js'
import type { RequestIdentity } from './core/permissions.js'

export type AppEnv = {
  Variables: {
    requestId: string
    db: Db
    env: Env
    identity: RequestIdentity
  }
}

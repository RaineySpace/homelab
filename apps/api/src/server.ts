import { serve } from '@hono/node-server'
import { loadEnv } from './env.js'
import { applyMigrations, createDb, createSqlite } from './core/database/client.js'
import { bootstrapHousehold } from './core/bootstrap.js'
import { createApp } from './app.js'

const env = loadEnv()
const sqlite = createSqlite(env)
applyMigrations(sqlite)
const db = createDb(sqlite)
bootstrapHousehold(db, env)

const app = createApp({ env, db })

serve(
  {
    fetch: app.fetch,
    hostname: env.API_HOST,
    port: env.API_PORT,
  },
  (info) => {
    console.log(`Family OS API listening on http://${info.address}:${info.port}`)
  },
)

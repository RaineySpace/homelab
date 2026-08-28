import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { testEnv } from '../env.js'
import { applyMigrations, createDb, createSqlite } from '../core/database/client.js'
import { bootstrapHousehold } from '../core/bootstrap.js'
import { createApp } from '../app.js'

const env = testEnv()
const sqlite = createSqlite(env)
applyMigrations(sqlite)
const db = createDb(sqlite)
bootstrapHousehold(db, env)
const app = createApp({ env, db })
const raw = app.getOpenAPI31Document({
  openapi: '3.1.0',
  info: {
    title: 'Family OS API',
    version: '1.0.0',
    description: '家庭操作系统的稳定 HTTP 契约。',
  },
  servers: [{ url: '/api/v1' }],
})

const paths: Record<string, unknown> = {}
for (const [path, value] of Object.entries(raw.paths ?? {})) {
  const next = path.replace(/^\/api\/v1/, '') || '/'
  paths[next] = value
}
const document = { ...raw, paths }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../')
const out = resolve(root, 'openapi/openapi.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`)
console.log(`wrote ${out}`)

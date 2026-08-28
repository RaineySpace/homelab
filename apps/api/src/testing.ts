import type { FamilyApp } from './app.js'
import { createApp } from './app.js'
import { applyMigrations, createDb, createSqlite } from './core/database/client.js'
import { bootstrapHousehold } from './core/bootstrap.js'
import { testEnv } from './env.js'

export async function createTestApp() {
  const env = testEnv()
  const sqlite = createSqlite(env)
  applyMigrations(sqlite)
  const db = createDb(sqlite)
  bootstrapHousehold(db, env)
  const app = createApp({ env, db })
  return { app, db, sqlite, env }
}

export async function login(app: FamilyApp, username = 'admin', password = 'changeme') {
  const response = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const cookie = response.headers.get('set-cookie') ?? ''
  return { response, cookie: cookie.split(';')[0] ?? '' }
}

export function jsonHeaders(cookie?: string, extra?: Record<string, string>) {
  return {
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
    ...extra,
  }
}

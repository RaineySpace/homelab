import type { FamilyApp } from './app.js'
import { createApp } from './app.js'
import { applyMigrations, createDb, createSqlite } from './core/database/client.js'
import { bootstrapHousehold } from './core/bootstrap.js'
import { loadEnv } from './env.js'

export async function createTestApp(envOverrides: Record<string, string> = {}) {
  const env = loadEnv({
    DATA_DIR: ':memory:',
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-session-secret-change-me',
    BOOTSTRAP_ADMIN_USERNAME: 'admin',
    BOOTSTRAP_ADMIN_PASSWORD: 'changeme',
    BOOTSTRAP_HOUSEHOLD_NAME: '默认家庭',
    PUBLIC_ORIGIN: 'http://family.example.com',
    NODE_ENV: 'test',
    ...envOverrides,
  })
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

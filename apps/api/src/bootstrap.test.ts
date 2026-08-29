import { describe, expect, it } from 'vitest'
import { bootstrapHousehold, countAccounts } from './core/bootstrap.js'
import { verifyPassword } from './core/crypto.js'
import { applyMigrations, createDb, createSqlite } from './core/database/client.js'
import { accounts, sessions } from './core/database/schema.js'
import { loadEnv } from './env.js'

function testDatabase() {
  const env = loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'test' })
  const sqlite = createSqlite(env)
  applyMigrations(sqlite)
  return { db: createDb(sqlite), sqlite }
}

describe('household bootstrap credentials', () => {
  it('rejects the public development password when creating a production household', () => {
    const { db, sqlite } = testDatabase()
    const env = loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'production' })

    expect(() => bootstrapHousehold(db, env)).toThrow(/BOOTSTRAP_ADMIN_PASSWORD/)
    expect(() =>
      bootstrapHousehold(
        db,
        loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'production', BOOTSTRAP_ADMIN_PASSWORD: 'too-short' }),
      ),
    ).toThrow(/BOOTSTRAP_ADMIN_PASSWORD/)
    expect(countAccounts(db)).toBe(0)
    sqlite.close()
  })

  it('creates a production household with an explicit strong password', () => {
    const { db, sqlite } = testDatabase()
    const password = 'test-only-admin-password'
    const env = loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'production', BOOTSTRAP_ADMIN_PASSWORD: password })

    bootstrapHousehold(db, env)

    const account = db.select().from(accounts).get()
    expect(account).toBeTruthy()
    expect(verifyPassword(password, account?.passwordHash ?? '')).toBe(true)
    sqlite.close()
  })

  it('rotates an existing development password and revokes its sessions in production', () => {
    const { db, sqlite } = testDatabase()
    bootstrapHousehold(db, loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'development' }))
    const account = db.select().from(accounts).get()
    expect(account).toBeTruthy()
    db.insert(sessions)
      .values({
        id: 'sess_existing',
        accountId: account?.id ?? '',
        tokenHash: 'test-token-hash',
        expiresAt: '2099-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
      .run()

    expect(() => bootstrapHousehold(db, loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'production' }))).toThrow(
      /BOOTSTRAP_ADMIN_PASSWORD/,
    )
    expect(db.select().from(sessions).all()).toHaveLength(1)

    const password = 'test-only-rotated-password'
    bootstrapHousehold(
      db,
      loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'production', BOOTSTRAP_ADMIN_PASSWORD: password }),
    )

    const rotated = db.select().from(accounts).get()
    expect(verifyPassword('changeme', rotated?.passwordHash ?? '')).toBe(false)
    expect(verifyPassword(password, rotated?.passwordHash ?? '')).toBe(true)
    expect(db.select().from(sessions).all()).toHaveLength(0)
    expect(() => bootstrapHousehold(db, loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'production' }))).not.toThrow()

    const replacement = 'test-only-unrelated-password'
    expect(() =>
      bootstrapHousehold(
        db,
        loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'production', BOOTSTRAP_ADMIN_PASSWORD: replacement }),
      ),
    ).not.toThrow()
    const unchanged = db.select().from(accounts).get()
    expect(verifyPassword(password, unchanged?.passwordHash ?? '')).toBe(true)
    expect(verifyPassword(replacement, unchanged?.passwordHash ?? '')).toBe(false)
    sqlite.close()
  })
})

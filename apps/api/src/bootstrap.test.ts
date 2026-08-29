import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootstrapHousehold, countAccounts } from './core/bootstrap.js'
import { hashPassword, verifyPassword } from './core/crypto.js'
import { applyMigrations, createDb, createSqlite } from './core/database/client.js'
import { accounts, households, people, sessions } from './core/database/schema.js'
import { loadEnv } from './env.js'

function testDatabase() {
  const env = loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'test' })
  const sqlite = createSqlite(env)
  applyMigrations(sqlite)
  return { db: createDb(sqlite), sqlite }
}

describe('household bootstrap credentials', () => {
  it('migrates a pre-tracking database without changing account ids, roles, or audit references', () => {
    const env = loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'test' })
    const sqlite = createSqlite(env)
    const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle')
    sqlite.exec(readFileSync(resolve(migrationsDir, '0001_init.sql'), 'utf8'))
    sqlite.exec(readFileSync(resolve(migrationsDir, '0002_agent_model.sql'), 'utf8'))
    const at = '2026-01-01T00:00:00.000Z'
    sqlite.prepare('INSERT INTO households (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run('hh_before_migrations', '迁移前家庭', at, at)
    sqlite.prepare(
      'INSERT INTO accounts (id, household_id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('acct_before_migrations', 'hh_before_migrations', 'existing', hashPassword('existing-password'), 'member', at, at)
    sqlite.prepare(
      'INSERT INTO audit_events (id, household_id, actor_account_id, source, command, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run('audit_before_migrations', 'hh_before_migrations', 'acct_before_migrations', 'manual', 'test.before', 'account', 'acct_before_migrations', at)

    applyMigrations(sqlite)

    expect(sqlite.prepare('SELECT id, role FROM accounts').get()).toEqual({
      id: 'acct_before_migrations',
      role: 'member',
    })
    expect(sqlite.prepare('SELECT actor_account_id FROM audit_events').get()).toEqual({
      actor_account_id: 'acct_before_migrations',
    })
    expect(sqlite.prepare('PRAGMA table_info(accounts)').all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'person_id' }),
        expect.objectContaining({ name: 'disabled_at' }),
      ]),
    )
    sqlite.close()
  })

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
    const person = db.select().from(people).get()
    expect(account).toBeTruthy()
    expect(account?.personId).toBe(person?.id)
    expect(person?.name).toBe('管理员')
    expect(verifyPassword(password, account?.passwordHash ?? '')).toBe(true)
    sqlite.close()
  })

  it('applies each migration once and enforces a single owner', () => {
    const { db, sqlite } = testDatabase()
    applyMigrations(sqlite)
    bootstrapHousehold(db, loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'development' }))

    const migrations = sqlite.prepare('SELECT name FROM schema_migrations ORDER BY name').all() as Array<{ name: string }>
    const migrationNames = migrations.map((row) => row.name)
    expect(migrationNames).toEqual(expect.arrayContaining([
      '0001_init.sql',
      '0002_agent_model.sql',
      '0003_account_management.sql',
    ]))
    expect(new Set(migrationNames).size).toBe(migrationNames.length)
    applyMigrations(sqlite)
    expect(sqlite.prepare('SELECT name FROM schema_migrations ORDER BY name').all()).toEqual(migrations)

    const owner = db.select().from(accounts).get()!
    const at = new Date().toISOString()
    db.insert(people)
      .values({
        id: 'person_second_owner',
        householdId: owner.householdId,
        name: '第二个管理员',
        sex: null,
        birthYear: null,
        birthMonth: null,
        birthDay: null,
        version: 1,
        archivedAt: null,
        createdAt: at,
        updatedAt: at,
      })
      .run()
    expect(() =>
      db.insert(accounts)
        .values({
          id: 'acct_second_owner',
          householdId: owner.householdId,
          personId: 'person_second_owner',
          username: 'second-owner',
          passwordHash: owner.passwordHash,
          role: 'owner',
          disabledAt: null,
          createdAt: at,
          updatedAt: at,
        })
        .run(),
    ).toThrow()
    sqlite.close()
  })

  it('links a legacy owner and disables unlinked ordinary accounts without changing ids', () => {
    const { db, sqlite } = testDatabase()
    const at = '2026-01-01T00:00:00.000Z'
    db.insert(households)
      .values({ id: 'hh_legacy', name: '旧家庭', createdAt: at, updatedAt: at })
      .run()
    db.insert(people)
      .values({
        id: 'person_legacy_owner',
        householdId: 'hh_legacy',
        name: '家长',
        version: 1,
        createdAt: at,
        updatedAt: at,
      })
      .run()
    db.insert(accounts)
      .values([
        {
          id: 'acct_legacy_owner',
          householdId: 'hh_legacy',
          username: 'legacy-owner',
          passwordHash: hashPassword('legacy-owner-password'),
          role: 'owner',
          createdAt: at,
          updatedAt: at,
        },
        {
          id: 'acct_legacy_member',
          householdId: 'hh_legacy',
          username: 'legacy-member',
          passwordHash: hashPassword('legacy-member-password'),
          role: 'member',
          createdAt: at,
          updatedAt: at,
        },
      ])
      .run()
    db.insert(sessions)
      .values({
        id: 'sess_legacy_member',
        accountId: 'acct_legacy_member',
        tokenHash: 'legacy-session-token',
        expiresAt: '2099-01-01T00:00:00.000Z',
        createdAt: at,
      })
      .run()

    bootstrapHousehold(
      db,
      loadEnv({ DATA_DIR: ':memory:', NODE_ENV: 'development', BOOTSTRAP_ADMIN_PERSON_NAME: '家长' }),
    )

    const owner = db.select().from(accounts).where(eq(accounts.id, 'acct_legacy_owner')).get()
    const member = db.select().from(accounts).where(eq(accounts.id, 'acct_legacy_member')).get()
    expect(owner?.personId).toBe('person_legacy_owner')
    expect(member?.disabledAt).toBeTruthy()
    expect(db.select().from(sessions).all()).toHaveLength(0)
    expect(db.select().from(accounts).all().map((account) => account.id).sort()).toEqual([
      'acct_legacy_member',
      'acct_legacy_owner',
    ])
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

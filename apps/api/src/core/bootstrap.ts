import { eq } from 'drizzle-orm'
import { createId, nowIso } from './ids.js'
import { hashPassword, verifyPassword } from './crypto.js'
import { accounts, households, sessions } from './database/schema.js'
import type { Db } from './database/client.js'
import type { Env } from '../env.js'

const developmentAdminPassword = 'changeme'

function assertSecureProductionBootstrapPassword(env: Env): void {
  if (env.NODE_ENV !== 'production') return
  if (
    env.BOOTSTRAP_ADMIN_PASSWORD === developmentAdminPassword ||
    env.BOOTSTRAP_ADMIN_PASSWORD.length < 12
  ) {
    throw new Error('生产环境必须设置至少 12 位且不为默认值的 BOOTSTRAP_ADMIN_PASSWORD')
  }
}

export function bootstrapHousehold(db: Db, env: Env): void {
  const existing = db.select({ id: accounts.id, passwordHash: accounts.passwordHash }).from(accounts).all()
  if (existing.length > 0) {
    const accountsUsingDevelopmentPassword = existing.filter((account) =>
      verifyPassword(developmentAdminPassword, account.passwordHash),
    )
    if (env.NODE_ENV === 'production' && accountsUsingDevelopmentPassword.length > 0) {
      assertSecureProductionBootstrapPassword(env)
      const at = nowIso()
      db.transaction((tx) => {
        for (const account of accountsUsingDevelopmentPassword) {
          tx.update(accounts)
            .set({ passwordHash: hashPassword(env.BOOTSTRAP_ADMIN_PASSWORD), updatedAt: at })
            .where(eq(accounts.id, account.id))
            .run()
          tx.delete(sessions).where(eq(sessions.accountId, account.id)).run()
        }
      })
    }
    return
  }

  assertSecureProductionBootstrapPassword(env)
  const at = nowIso()
  const householdId = createId('hh')
  const accountId = createId('acct')
  db.insert(households)
    .values({
      id: householdId,
      name: env.BOOTSTRAP_HOUSEHOLD_NAME,
      createdAt: at,
      updatedAt: at,
    })
    .run()
  db.insert(accounts)
    .values({
      id: accountId,
      householdId,
      username: env.BOOTSTRAP_ADMIN_USERNAME,
      passwordHash: hashPassword(env.BOOTSTRAP_ADMIN_PASSWORD),
      role: 'owner',
      createdAt: at,
      updatedAt: at,
    })
    .run()
}

export function countAccounts(db: Db): number {
  return db.select({ id: accounts.id }).from(accounts).all().length
}

export function findHousehold(db: Db, id: string) {
  return db.select().from(households).where(eq(households.id, id)).get()
}

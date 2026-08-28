import { eq } from 'drizzle-orm'
import { createId, nowIso } from './ids.js'
import { hashPassword } from './crypto.js'
import { accounts, households } from './database/schema.js'
import type { Db } from './database/client.js'
import type { Env } from '../env.js'

export function bootstrapHousehold(db: Db, env: Env): void {
  const existing = db.select({ id: accounts.id }).from(accounts).limit(1).get()
  if (existing) return
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

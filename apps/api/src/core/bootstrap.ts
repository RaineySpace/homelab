import { and, eq, isNull } from 'drizzle-orm'
import { createId, nowIso } from './ids.js'
import { hashPassword, verifyPassword } from './crypto.js'
import { accounts, households, people, sessions } from './database/schema.js'
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
  const existing = db.select().from(accounts).all()
  if (existing.length > 0) {
    const owners = existing.filter((account) => account.role === 'owner')
    if (owners.length !== 1) {
      throw new Error(`数据库必须且只能存在一个 owner，当前为 ${owners.length} 个`)
    }
    const owner = owners[0]!
    if (owner.disabledAt) throw new Error('owner 必须保持启用')
    if (env.NODE_ENV === 'production' && verifyPassword(developmentAdminPassword, owner.passwordHash)) {
      assertSecureProductionBootstrapPassword(env)
      const at = nowIso()
      db.transaction((tx) => {
        tx.update(accounts)
          .set({ passwordHash: hashPassword(env.BOOTSTRAP_ADMIN_PASSWORD), updatedAt: at })
          .where(eq(accounts.id, owner.id))
          .run()
        tx.delete(sessions).where(eq(sessions.accountId, owner.id)).run()
      })
    }
    if (!owner.personId) {
      const candidates = db
        .select({ id: people.id })
        .from(people)
        .leftJoin(accounts, eq(accounts.personId, people.id))
        .where(
          and(
            eq(people.householdId, owner.householdId),
            eq(people.name, env.BOOTSTRAP_ADMIN_PERSON_NAME),
            isNull(people.archivedAt),
            isNull(accounts.id),
          ),
        )
        .all()
      if (candidates.length > 1) {
        throw new Error('存在多个同名且未绑定的管理员人物，无法自动关联 owner')
      }
      const at = nowIso()
      const personId = candidates[0]?.id ?? createId('person')
      db.transaction((tx) => {
        if (candidates.length === 0) {
          tx.insert(people)
            .values({
              id: personId,
              householdId: owner.householdId,
              name: env.BOOTSTRAP_ADMIN_PERSON_NAME,
              version: 1,
              createdAt: at,
              updatedAt: at,
            })
            .run()
        }
        tx.update(accounts).set({ personId, updatedAt: at }).where(eq(accounts.id, owner.id)).run()
      })
    }
    const currentOwner = db.select().from(accounts).where(eq(accounts.id, owner.id)).get()!
    const ownerPerson = currentOwner.personId
      ? db.select().from(people).where(eq(people.id, currentOwner.personId)).get()
      : undefined
    if (!ownerPerson || ownerPerson.householdId !== owner.householdId || ownerPerson.archivedAt) {
      throw new Error('owner 必须关联一个未归档的家庭人物')
    }
    const at = nowIso()
    const invalidOrdinary = db
      .select({
        accountId: accounts.id,
        accountHouseholdId: accounts.householdId,
        role: accounts.role,
        disabledAt: accounts.disabledAt,
        personId: accounts.personId,
        linkedPersonId: people.id,
        personHouseholdId: people.householdId,
        personArchivedAt: people.archivedAt,
      })
      .from(accounts)
      .leftJoin(people, eq(people.id, accounts.personId))
      .all()
      .filter(
        (row) =>
          row.role !== 'owner' &&
          !row.disabledAt &&
          (!row.personId ||
            !row.linkedPersonId ||
            row.personHouseholdId !== row.accountHouseholdId ||
            row.personArchivedAt !== null),
      )
    if (invalidOrdinary.length > 0) {
      db.transaction((tx) => {
        for (const account of invalidOrdinary) {
          tx.update(accounts).set({ disabledAt: at, updatedAt: at }).where(eq(accounts.id, account.accountId)).run()
          tx.delete(sessions).where(eq(sessions.accountId, account.accountId)).run()
        }
      })
    }
    return
  }

  assertSecureProductionBootstrapPassword(env)
  const at = nowIso()
  const householdId = createId('hh')
  const accountId = createId('acct')
  const personId = createId('person')
  db.transaction((tx) => {
    tx.insert(households)
      .values({
        id: householdId,
        name: env.BOOTSTRAP_HOUSEHOLD_NAME,
        createdAt: at,
        updatedAt: at,
      })
      .run()
    tx.insert(people)
      .values({
        id: personId,
        householdId,
        name: env.BOOTSTRAP_ADMIN_PERSON_NAME,
        version: 1,
        createdAt: at,
        updatedAt: at,
      })
      .run()
    tx.insert(accounts)
      .values({
        id: accountId,
        householdId,
        personId,
        username: env.BOOTSTRAP_ADMIN_USERNAME,
        passwordHash: hashPassword(env.BOOTSTRAP_ADMIN_PASSWORD),
        role: 'owner',
        createdAt: at,
        updatedAt: at,
      })
      .run()
  })
}

export function countAccounts(db: Db): number {
  return db.select({ id: accounts.id }).from(accounts).all().length
}

export function findHousehold(db: Db, id: string) {
  return db.select().from(households).where(eq(households.id, id)).get()
}

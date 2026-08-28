import { and, eq } from 'drizzle-orm'
import { AppError, Errors } from './errors.js'
import { hashPayload } from './crypto.js'
import { nowIso } from './ids.js'
import { idempotencyKeys } from './database/schema.js'
import type { Db } from './database/client.js'
import type { CommandContext } from './context.js'

export function withIdempotency<T>(
  db: Db,
  ctx: CommandContext,
  command: string,
  payload: unknown,
  run: () => T,
): T {
  if (!ctx.idempotencyKey) return run()
  const requestHash = hashPayload({ command, payload })
  const existing = db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.householdId, ctx.identity.householdId),
        eq(idempotencyKeys.accountId, ctx.identity.accountId),
        eq(idempotencyKeys.key, ctx.idempotencyKey),
      ),
    )
    .get()
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw Errors.conflict(
        'IDEMPOTENCY_KEY_CONFLICT',
        '幂等键冲突',
        '同一个 Idempotency-Key 被用于不同的请求内容',
      )
    }
    return JSON.parse(existing.responseJson) as T
  }
  const result = run()
  try {
    db.insert(idempotencyKeys)
      .values({
        key: ctx.idempotencyKey,
        householdId: ctx.identity.householdId,
        accountId: ctx.identity.accountId,
        requestHash,
        statusCode: 200,
        responseJson: JSON.stringify(result),
        createdAt: nowIso(),
      })
      .run()
  } catch (error) {
    const raced = db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.householdId, ctx.identity.householdId),
          eq(idempotencyKeys.accountId, ctx.identity.accountId),
          eq(idempotencyKeys.key, ctx.idempotencyKey),
        ),
      )
      .get()
    if (raced) return JSON.parse(raced.responseJson) as T
    throw error
  }
  return result
}

export function requireIdempotencyReplayError(error: unknown): boolean {
  return error instanceof AppError && error.code === 'IDEMPOTENCY_KEY_CONFLICT'
}

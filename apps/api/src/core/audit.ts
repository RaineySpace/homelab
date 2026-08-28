import { createId, nowIso } from './ids.js'
import { auditEvents } from './database/schema.js'
import type { Db } from './database/client.js'
import type { CommandContext } from './context.js'

export function writeAudit(
  db: Db,
  ctx: CommandContext,
  input: {
    command: string
    entityType?: string
    entityId?: string
    detail?: unknown
  },
): void {
  db.insert(auditEvents)
    .values({
      id: createId('audit'),
      householdId: ctx.identity.householdId,
      actorAccountId: ctx.identity.accountId,
      source: ctx.source,
      command: input.command,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      detailJson: input.detail ? JSON.stringify(input.detail) : null,
      createdAt: nowIso(),
    })
    .run()
}

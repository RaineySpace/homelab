import { and, desc, eq } from 'drizzle-orm'
import { createRoute, z } from '@hono/zod-openapi'
import { createRouter } from '../core/router.js'
import { people, personRevisions } from '../core/database/schema.js'
import { PartialBirthDateSchema, SexSchema, type PartialBirthDate, type Sex } from '../core/dates.js'
import { Errors } from '../core/errors.js'
import { createId, nowIso } from '../core/ids.js'
import { withIdempotency } from '../core/idempotency.js'
import { writeAudit } from '../core/audit.js'
import { errorResponses, jsonContent } from '../core/openapi.js'
import { hasPermission } from '../core/permissions.js'
import type { CommandContext } from '../core/context.js'
import type { Db } from '../core/database/client.js'

const PersonResponseSchema = z
  .strictObject({
    id: z.string(),
    name: z.string(),
    birth: PartialBirthDateSchema.nullable(),
    sex: SexSchema.nullable(),
    version: z.number().int(),
    archivedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Person')

const CreatePersonRequestSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(50),
    birth: PartialBirthDateSchema.nullable(),
    sex: SexSchema.nullable(),
  })
  .openapi('CreatePersonRequest')

const UpdatePersonRequestSchema = z
  .strictObject({
    version: z.number().int().positive(),
    name: z.string().trim().min(1).max(50).optional(),
    birth: PartialBirthDateSchema.nullable().optional(),
    sex: SexSchema.nullable().optional(),
  })
  .openapi('UpdatePersonRequest')

const PersonIdParam = z.strictObject({
  personId: z.string().min(1).openapi({ param: { name: 'personId', in: 'path' } }),
})

const RevisionSchema = z
  .strictObject({
    id: z.string(),
    version: z.number().int(),
    snapshot: PersonResponseSchema,
    actorAccountId: z.string(),
    source: z.enum(['manual', 'agent', 'import']),
    createdAt: z.string(),
  })
  .openapi('PersonRevision')

export type PersonResponse = z.infer<typeof PersonResponseSchema>

function birthFromRow(row: typeof people.$inferSelect): PartialBirthDate | null {
  if (row.birthYear == null) return null
  return {
    year: row.birthYear,
    ...(row.birthMonth != null ? { month: row.birthMonth } : {}),
    ...(row.birthDay != null ? { day: row.birthDay } : {}),
  }
}

function toPerson(row: typeof people.$inferSelect): PersonResponse {
  return {
    id: row.id,
    name: row.name,
    birth: birthFromRow(row),
    sex: (row.sex as Sex | null) ?? null,
    version: row.version,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function birthColumns(birth: PartialBirthDate | null) {
  return {
    birthYear: birth?.year ?? null,
    birthMonth: birth?.month ?? null,
    birthDay: birth?.day ?? null,
  }
}

function requirePerm(ctx: CommandContext, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(ctx.identity, permission)) throw Errors.forbidden()
}

export function listPeopleCommand(db: Db, ctx: CommandContext, includeArchived = false) {
  requirePerm(ctx, 'people:read')
  const rows = db
    .select()
    .from(people)
    .where(eq(people.householdId, ctx.identity.householdId))
    .orderBy(desc(people.createdAt))
    .all()
    .filter((row) => includeArchived || !row.archivedAt)
  return rows.map(toPerson)
}

export function getPersonCommand(db: Db, ctx: CommandContext, personId: string) {
  requirePerm(ctx, 'people:read')
  const row = db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.householdId, ctx.identity.householdId)))
    .get()
  if (!row) throw Errors.notFound('人物不存在', '找不到该家庭成员')
  return toPerson(row)
}

export function createPersonCommand(
  db: Db,
  ctx: CommandContext,
  input: z.infer<typeof CreatePersonRequestSchema>,
) {
  requirePerm(ctx, 'people:create')
  return withIdempotency(db, ctx, 'people.create', input, () => {
    const at = nowIso()
    const id = createId('person')
    db.insert(people)
      .values({
        id,
        householdId: ctx.identity.householdId,
        name: input.name,
        sex: input.sex,
        ...birthColumns(input.birth),
        version: 1,
        archivedAt: null,
        createdAt: at,
        updatedAt: at,
      })
      .run()
    const created = getPersonCommand(db, ctx, id)
    writeAudit(db, ctx, { command: 'people.create', entityType: 'person', entityId: id })
    return created
  })
}

export function updatePersonCommand(
  db: Db,
  ctx: CommandContext,
  personId: string,
  input: z.infer<typeof UpdatePersonRequestSchema>,
) {
  requirePerm(ctx, 'people:update')
  const current = db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.householdId, ctx.identity.householdId)))
    .get()
  if (!current || current.archivedAt) throw Errors.notFound('人物不存在', '找不到该家庭成员')
  if (current.version !== input.version) {
    throw Errors.conflict('ENTITY_VERSION_CONFLICT', '版本冲突', '人物已被其他人更新，请刷新后再试')
  }
  db.insert(personRevisions)
    .values({
      id: createId('rev'),
      personId,
      householdId: ctx.identity.householdId,
      version: current.version,
      snapshotJson: JSON.stringify(toPerson(current)),
      actorAccountId: ctx.identity.accountId,
      source: ctx.source,
      createdAt: nowIso(),
    })
    .run()
  const at = nowIso()
  const nextBirth = input.birth === undefined ? birthFromRow(current) : input.birth
  const updated = db
    .update(people)
    .set({
      name: input.name ?? current.name,
      sex: input.sex === undefined ? current.sex : input.sex,
      ...birthColumns(nextBirth),
      version: current.version + 1,
      updatedAt: at,
    })
    .where(
      and(
        eq(people.id, personId),
        eq(people.version, input.version),
        eq(people.householdId, ctx.identity.householdId),
      ),
    )
    .returning()
    .all()
  if (updated.length === 0) {
    throw Errors.conflict('ENTITY_VERSION_CONFLICT', '版本冲突', '人物已被其他人更新，请刷新后再试')
  }
  const person = toPerson(updated[0]!)
  writeAudit(db, ctx, { command: 'people.update', entityType: 'person', entityId: personId })
  return person
}

export function archivePersonCommand(db: Db, ctx: CommandContext, personId: string) {
  requirePerm(ctx, 'people:archive')
  const current = getPersonCommand(db, ctx, personId)
  if (current.archivedAt) return current
  const at = nowIso()
  db.update(people)
    .set({ archivedAt: at, updatedAt: at })
    .where(and(eq(people.id, personId), eq(people.householdId, ctx.identity.householdId)))
    .run()
  writeAudit(db, ctx, { command: 'people.archive', entityType: 'person', entityId: personId })
  return getPersonCommand(db, ctx, personId)
}

export function listPersonRevisionsCommand(db: Db, ctx: CommandContext, personId: string) {
  requirePerm(ctx, 'people:read')
  getPersonCommand(db, ctx, personId)
  return db
    .select()
    .from(personRevisions)
    .where(
      and(eq(personRevisions.personId, personId), eq(personRevisions.householdId, ctx.identity.householdId)),
    )
    .orderBy(desc(personRevisions.createdAt))
    .all()
    .map((row) => ({
      id: row.id,
      version: row.version,
      snapshot: JSON.parse(row.snapshotJson) as PersonResponse,
      actorAccountId: row.actorAccountId,
      source: row.source as 'manual' | 'agent' | 'import',
      createdAt: row.createdAt,
    }))
}

function commandCtx(c: { get: (k: 'identity' | 'requestId') => unknown }, source: CommandContext['source'] = 'manual', idempotencyKey?: string): CommandContext {
  return {
    identity: c.get('identity') as CommandContext['identity'],
    requestId: c.get('requestId') as string,
    source,
    idempotencyKey,
  }
}

export function peopleRoutes() {
  const routes = createRouter()

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/people',
      tags: ['People'],
      request: {
        query: z.strictObject({
          includeArchived: z.enum(['true', 'false']).optional(),
        }),
      },
      responses: { 200: jsonContent(z.array(PersonResponseSchema), '人物列表'), ...errorResponses },
    }),
    (c) => {
      const include = c.req.valid('query').includeArchived === 'true'
      return c.json(listPeopleCommand(c.get('db'), commandCtx(c), include), 200)
    },
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/people',
      tags: ['People'],
      request: { body: jsonContent(CreatePersonRequestSchema, '创建人物') },
      responses: {
        201: jsonContent(PersonResponseSchema, '已创建'),
        ...errorResponses,
      },
    }),
    (c) => {
      const key = c.req.header('Idempotency-Key') ?? undefined
      const person = createPersonCommand(c.get('db'), commandCtx(c, 'manual', key), c.req.valid('json'))
      return c.json(person, 201)
    },
  )

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/people/{personId}',
      tags: ['People'],
      request: { params: PersonIdParam },
      responses: { 200: jsonContent(PersonResponseSchema, '人物'), ...errorResponses },
    }),
    (c) => c.json(getPersonCommand(c.get('db'), commandCtx(c), c.req.valid('param').personId), 200),
  )

  routes.openapi(
    createRoute({
      method: 'patch',
      path: '/people/{personId}',
      tags: ['People'],
      request: {
        params: PersonIdParam,
        body: jsonContent(UpdatePersonRequestSchema, '更新人物'),
      },
      responses: { 200: jsonContent(PersonResponseSchema, '已更新'), ...errorResponses },
    }),
    (c) =>
      c.json(
        updatePersonCommand(c.get('db'), commandCtx(c), c.req.valid('param').personId, c.req.valid('json')),
        200,
      ),
  )

  routes.openapi(
    createRoute({
      method: 'delete',
      path: '/people/{personId}',
      tags: ['People'],
      request: { params: PersonIdParam },
      responses: { 200: jsonContent(PersonResponseSchema, '已归档'), ...errorResponses },
    }),
    (c) => c.json(archivePersonCommand(c.get('db'), commandCtx(c), c.req.valid('param').personId), 200),
  )

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/people/{personId}/revisions',
      tags: ['People'],
      request: { params: PersonIdParam },
      responses: { 200: jsonContent(z.array(RevisionSchema), '修订历史'), ...errorResponses },
    }),
    (c) =>
      c.json(listPersonRevisionsCommand(c.get('db'), commandCtx(c), c.req.valid('param').personId), 200),
  )

  return routes
}

export const peopleToolSchemas = {
  create: CreatePersonRequestSchema,
  update: UpdatePersonRequestSchema.extend({ personId: z.string() }),
}

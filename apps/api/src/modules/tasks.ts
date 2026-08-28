import { and, desc, eq } from 'drizzle-orm'
import { createRoute, z } from '@hono/zod-openapi'
import { createRouter } from '../core/router.js'
import { tasks } from '../core/database/schema.js'
import { Errors } from '../core/errors.js'
import { createId, nowIso } from '../core/ids.js'
import { withIdempotency } from '../core/idempotency.js'
import { writeAudit } from '../core/audit.js'
import { errorResponses, jsonContent } from '../core/openapi.js'
import { hasPermission } from '../core/permissions.js'
import { getPersonCommand } from './people.js'
import type { CommandContext } from '../core/context.js'
import type { Db } from '../core/database/client.js'

const TaskResponseSchema = z
  .strictObject({
    id: z.string(),
    title: z.string(),
    notes: z.string().nullable(),
    assigneePersonId: z.string().nullable(),
    dueAt: z.string().nullable(),
    status: z.enum(['open', 'completed']),
    completedAt: z.string().nullable(),
    version: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Task')

const CreateTaskRequestSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(80),
    notes: z.string().max(2000).nullable(),
    assigneePersonId: z.string().nullable(),
    dueAt: z.string().nullable(),
  })
  .openapi('CreateTaskRequest')

const UpdateTaskRequestSchema = z
  .strictObject({
    version: z.number().int().positive(),
    title: z.string().trim().min(1).max(80).optional(),
    notes: z.string().max(2000).nullable().optional(),
    assigneePersonId: z.string().nullable().optional(),
    dueAt: z.string().nullable().optional(),
  })
  .openapi('UpdateTaskRequest')

function requirePerm(ctx: CommandContext, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(ctx.identity, permission)) throw Errors.forbidden()
}

function toTask(row: typeof tasks.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    assigneePersonId: row.assigneePersonId,
    dueAt: row.dueAt,
    status: row.status as 'open' | 'completed',
    completedAt: row.completedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function assertAssignee(db: Db, ctx: CommandContext, personId: string | null) {
  if (!personId) return
  const person = getPersonCommand(db, ctx, personId)
  if (person.archivedAt) {
    throw Errors.validation('负责人已归档', [{ path: ['assigneePersonId'], code: 'archived', message: person.name }])
  }
}

export function listTasksCommand(db: Db, ctx: CommandContext, status?: 'open' | 'completed') {
  requirePerm(ctx, 'tasks:read')
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.householdId, ctx.identity.householdId))
    .orderBy(desc(tasks.createdAt))
    .all()
    .filter((row) => !status || row.status === status)
    .map(toTask)
}

export function getTaskCommand(db: Db, ctx: CommandContext, taskId: string) {
  requirePerm(ctx, 'tasks:read')
  const row = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.householdId, ctx.identity.householdId)))
    .get()
  if (!row) throw Errors.notFound('任务不存在', '找不到该任务')
  return toTask(row)
}

export function createTaskCommand(db: Db, ctx: CommandContext, input: z.infer<typeof CreateTaskRequestSchema>) {
  requirePerm(ctx, 'tasks:create')
  return withIdempotency(db, ctx, 'tasks.create', input, () => {
    assertAssignee(db, ctx, input.assigneePersonId)
    const at = nowIso()
    const id = createId('task')
    db.insert(tasks)
      .values({
        id,
        householdId: ctx.identity.householdId,
        title: input.title,
        notes: input.notes,
        assigneePersonId: input.assigneePersonId,
        dueAt: input.dueAt,
        status: 'open',
        completedAt: null,
        version: 1,
        createdAt: at,
        updatedAt: at,
      })
      .run()
    writeAudit(db, ctx, { command: 'tasks.create', entityType: 'task', entityId: id })
    return getTaskCommand(db, ctx, id)
  })
}

export function updateTaskCommand(
  db: Db,
  ctx: CommandContext,
  taskId: string,
  input: z.infer<typeof UpdateTaskRequestSchema>,
) {
  requirePerm(ctx, 'tasks:update')
  const current = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.householdId, ctx.identity.householdId)))
    .get()
  if (!current) throw Errors.notFound('任务不存在', '找不到该任务')
  if (current.version !== input.version) {
    throw Errors.conflict('ENTITY_VERSION_CONFLICT', '版本冲突', '任务已被其他人更新，请刷新后再试')
  }
  if (input.assigneePersonId !== undefined) assertAssignee(db, ctx, input.assigneePersonId)
  const at = nowIso()
  const updated = db
    .update(tasks)
    .set({
      title: input.title ?? current.title,
      notes: input.notes === undefined ? current.notes : input.notes,
      assigneePersonId: input.assigneePersonId === undefined ? current.assigneePersonId : input.assigneePersonId,
      dueAt: input.dueAt === undefined ? current.dueAt : input.dueAt,
      version: current.version + 1,
      updatedAt: at,
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.version, input.version)))
    .returning()
    .all()
  if (updated.length === 0) {
    throw Errors.conflict('ENTITY_VERSION_CONFLICT', '版本冲突', '任务已被其他人更新，请刷新后再试')
  }
  writeAudit(db, ctx, { command: 'tasks.update', entityType: 'task', entityId: taskId })
  return toTask(updated[0]!)
}

export function completeTaskCommand(db: Db, ctx: CommandContext, taskId: string) {
  requirePerm(ctx, 'tasks:complete')
  const current = getTaskCommand(db, ctx, taskId)
  if (current.status === 'completed') return current
  const at = nowIso()
  db.update(tasks)
    .set({ status: 'completed', completedAt: at, updatedAt: at, version: current.version + 1 })
    .where(eq(tasks.id, taskId))
    .run()
  writeAudit(db, ctx, { command: 'tasks.complete', entityType: 'task', entityId: taskId })
  return getTaskCommand(db, ctx, taskId)
}

function commandCtx(c: { get: (k: 'identity' | 'requestId') => unknown }, key?: string): CommandContext {
  return {
    identity: c.get('identity') as CommandContext['identity'],
    requestId: c.get('requestId') as string,
    source: 'manual',
    idempotencyKey: key,
  }
}

export function taskRoutes() {
  const routes = createRouter()

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/tasks',
      tags: ['Tasks'],
      request: {
        query: z.strictObject({
          status: z.enum(['open', 'completed']).optional(),
        }),
      },
      responses: { 200: jsonContent(z.array(TaskResponseSchema), '任务列表'), ...errorResponses },
    }),
    (c) => c.json(listTasksCommand(c.get('db'), commandCtx(c), c.req.valid('query').status), 200),
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/tasks',
      tags: ['Tasks'],
      request: { body: jsonContent(CreateTaskRequestSchema, '创建任务') },
      responses: { 201: jsonContent(TaskResponseSchema, '已创建'), ...errorResponses },
    }),
    (c) =>
      c.json(
        createTaskCommand(
          c.get('db'),
          commandCtx(c, c.req.header('Idempotency-Key') ?? undefined),
          c.req.valid('json'),
        ),
        201,
      ),
  )

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/tasks/{taskId}',
      tags: ['Tasks'],
      request: {
        params: z.strictObject({
          taskId: z.string().openapi({ param: { name: 'taskId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(TaskResponseSchema, '任务'), ...errorResponses },
    }),
    (c) => c.json(getTaskCommand(c.get('db'), commandCtx(c), c.req.valid('param').taskId), 200),
  )

  routes.openapi(
    createRoute({
      method: 'patch',
      path: '/tasks/{taskId}',
      tags: ['Tasks'],
      request: {
        params: z.strictObject({
          taskId: z.string().openapi({ param: { name: 'taskId', in: 'path' } }),
        }),
        body: jsonContent(UpdateTaskRequestSchema, '更新任务'),
      },
      responses: { 200: jsonContent(TaskResponseSchema, '已更新'), ...errorResponses },
    }),
    (c) =>
      c.json(updateTaskCommand(c.get('db'), commandCtx(c), c.req.valid('param').taskId, c.req.valid('json')), 200),
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/tasks/{taskId}/complete',
      tags: ['Tasks'],
      request: {
        params: z.strictObject({
          taskId: z.string().openapi({ param: { name: 'taskId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(TaskResponseSchema, '已完成'), ...errorResponses },
    }),
    (c) => c.json(completeTaskCommand(c.get('db'), commandCtx(c), c.req.valid('param').taskId), 200),
  )

  return routes
}

export const taskToolSchemas = {
  create: CreateTaskRequestSchema,
}

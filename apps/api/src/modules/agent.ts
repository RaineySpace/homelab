import { and, eq } from 'drizzle-orm'
import { createRoute, z } from '@hono/zod-openapi'
import { createRouter } from '../core/router.js'
import { streamSSE } from 'hono/streaming'
import { agentActions, agentRuns } from '../core/database/schema.js'
import { AppError, Errors } from '../core/errors.js'
import { createId, nowIso } from '../core/ids.js'
import { errorResponses, jsonContent } from '../core/openapi.js'
import { hasPermission } from '../core/permissions.js'
import { writeAudit } from '../core/audit.js'
import {
  createModelGateway,
  isModelProviderId,
  listProviderCatalog,
  MODEL_PROVIDER_IDS,
  readHouseholdOverride,
  resolveModelSelection,
  saveHouseholdAgentModel,
  type ModelMessage,
} from '../core/agent/index.js'
import {
  archivePersonCommand,
  createPersonCommand,
  getPersonCommand,
  listPeopleCommand,
  peopleToolSchemas,
  updatePersonCommand,
} from './people.js'
import { composeMealDraftCommand, confirmMealDraftCommand, mealToolSchemas } from './meals.js'
import { createIngredientCommand, createRecipeCommand, listRecipesCommand, recipeToolSchemas } from './recipes.js'
import { createTaskCommand, listTasksCommand, taskToolSchemas } from './tasks.js'
import type { CommandContext } from '../core/context.js'
import type { Db } from '../core/database/client.js'
import type { Env } from '../env.js'
import type { RequestIdentity } from '../core/permissions.js'

export type AgentEvent =
  | { type: 'text.delta'; delta: string }
  | { type: 'tool.started'; toolExecutionId: string; tool: string }
  | { type: 'tool.completed'; toolExecutionId: string; result: unknown }
  | { type: 'approval.required'; actionId: string; summary: string }
  | { type: 'run.completed'; runId: string }
  | { type: 'run.failed'; runId: string; error: { title: string; detail: string; code: string } }

type ToolDef = {
  name: string
  description: string
  schema: z.ZodType
  sensitive?: boolean
  execute: (input: unknown, ctx: CommandContext, db: Db) => unknown
}

const tools: ToolDef[] = [
  {
    name: 'people.list',
    description: '列出家庭人物',
    schema: z.strictObject({}),
    execute: (_input, ctx, db) => listPeopleCommand(db, ctx),
  },
  {
    name: 'people.get',
    description: '读取一个人物',
    schema: z.strictObject({ personId: z.string() }),
    execute: (input, ctx, db) => getPersonCommand(db, ctx, (input as { personId: string }).personId),
  },
  {
    name: 'people.create',
    description: '创建人物',
    schema: peopleToolSchemas.create,
    execute: (input, ctx, db) => createPersonCommand(db, ctx, peopleToolSchemas.create.parse(input)),
  },
  {
    name: 'people.update',
    description: '更新人物',
    schema: peopleToolSchemas.update,
    execute: (input, ctx, db) => {
      const body = peopleToolSchemas.update.parse(input)
      const { personId, ...rest } = body
      return updatePersonCommand(db, ctx, personId, rest)
    },
  },
  {
    name: 'people.archive',
    description: '归档人物',
    schema: z.strictObject({ personId: z.string() }),
    sensitive: true,
    execute: (input, ctx, db) => archivePersonCommand(db, ctx, (input as { personId: string }).personId),
  },
  {
    name: 'recipes.list',
    description: '列出菜谱',
    schema: z.strictObject({}),
    execute: (_input, ctx, db) => listRecipesCommand(db, ctx),
  },
  {
    name: 'ingredients.create',
    description: '创建食材',
    schema: recipeToolSchemas.createIngredient,
    execute: (input, ctx, db) =>
      createIngredientCommand(db, ctx, recipeToolSchemas.createIngredient.parse(input)),
  },
  {
    name: 'recipes.create',
    description: '创建菜谱',
    schema: recipeToolSchemas.createRecipe,
    execute: (input, ctx, db) => createRecipeCommand(db, ctx, recipeToolSchemas.createRecipe.parse(input)),
  },
  {
    name: 'meals.compose',
    description: '创建配餐草稿',
    schema: mealToolSchemas.compose,
    execute: (input, ctx, db) => composeMealDraftCommand(db, ctx, mealToolSchemas.compose.parse(input)),
  },
  {
    name: 'meals.confirm',
    description: '确认配餐草稿成为正式用餐',
    schema: z.strictObject({ mealDraftId: z.string() }),
    sensitive: true,
    execute: (input, ctx, db) => confirmMealDraftCommand(db, ctx, (input as { mealDraftId: string }).mealDraftId),
  },
  {
    name: 'tasks.list',
    description: '列出任务',
    schema: z.strictObject({}),
    execute: (_input, ctx, db) => listTasksCommand(db, ctx),
  },
  {
    name: 'tasks.create',
    description: '创建任务',
    schema: taskToolSchemas.create,
    execute: (input, ctx, db) => createTaskCommand(db, ctx, taskToolSchemas.create.parse(input)),
  },
]

function findTool(name: string): ToolDef {
  const tool = tools.find((item) => item.name === name)
  if (!tool) throw Errors.notFound('工具不存在', `未知工具 ${name}`)
  return tool
}

function jsonSchema(schema: z.ZodType): unknown {
  try {
    return z.toJSONSchema(schema as z.ZodTypeAny)
  } catch {
    return { type: 'object' }
  }
}

const eventLog = new Map<string, AgentEvent[]>()

function pushEvent(runId: string, event: AgentEvent): AgentEvent {
  const list = eventLog.get(runId) ?? []
  list.push(event)
  eventLog.set(runId, list)
  return event
}

function agentContext(identity: RequestIdentity, requestId: string, runId: string, toolExecutionId?: string): CommandContext {
  return {
    identity,
    requestId,
    source: 'agent',
    agentRunId: runId,
    idempotencyKey: toolExecutionId,
  }
}

function executeTool(db: Db, ctx: CommandContext, name: string, raw: unknown) {
  const tool = findTool(name)
  const parsed = tool.schema.parse(raw)
  return tool.execute(parsed, ctx, db)
}

export async function* runAgent(options: {
  db: Db
  env: Env
  identity: RequestIdentity
  requestId: string
  message: string
  runId: string
}): AsyncGenerator<AgentEvent> {
  const { db, env, identity, requestId, message, runId } = options
  const household = readHouseholdOverride(db, env, identity.householdId)
  const { gateway } = createModelGateway(env, household)
  const openaiTools = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: jsonSchema(tool.schema),
  }))
  const messages: ModelMessage[] = [
    {
      role: 'system',
      content:
        '你是 Family OS 的家庭助手。只能通过工具改变家庭事实。不要编造 id。敏感写入会进入确认流。用中文回答。',
    },
    { role: 'user', content: message },
  ]
  try {
    for (let step = 0; step < 8; step += 1) {
      const result = await gateway.complete({ messages, tools: openaiTools })
      const assistant = result.message
      messages.push(assistant)
      if (assistant.tool_calls && assistant.tool_calls.length > 0) {
        for (const call of assistant.tool_calls) {
          const toolExecutionId = call.id || createId('tool')
          yield pushEvent(runId, { type: 'tool.started', toolExecutionId, tool: call.function.name })
          const args = JSON.parse(call.function.arguments || '{}') as unknown
          const tool = findTool(call.function.name)
          if (tool.sensitive) {
            const actionId = createId('act')
            db.insert(agentActions)
              .values({
                id: actionId,
                runId,
                householdId: identity.householdId,
                tool: tool.name,
                payloadJson: JSON.stringify(args),
                status: 'pending',
                summary: `待确认：${tool.name}`,
                createdAt: nowIso(),
                resolvedAt: null,
              })
              .run()
            yield pushEvent(runId, { type: 'approval.required', actionId, summary: `待确认：${tool.name}` })
            messages.push({
              role: 'tool',
              tool_call_id: toolExecutionId,
              content: JSON.stringify({ pendingActionId: actionId, status: 'approval.required' }),
            })
            yield pushEvent(runId, {
              type: 'tool.completed',
              toolExecutionId,
              result: { pendingActionId: actionId },
            })
            continue
          }
          const ctx = agentContext(identity, requestId, runId, toolExecutionId)
          const output = executeTool(db, ctx, tool.name, args)
          yield pushEvent(runId, { type: 'tool.completed', toolExecutionId, result: output })
          messages.push({
            role: 'tool',
            tool_call_id: toolExecutionId,
            content: JSON.stringify(output),
          })
        }
        continue
      }
      if (assistant.content) {
        yield pushEvent(runId, { type: 'text.delta', delta: assistant.content })
      }
      db.update(agentRuns)
        .set({ status: 'completed', updatedAt: nowIso() })
        .where(eq(agentRuns.id, runId))
        .run()
      yield pushEvent(runId, { type: 'run.completed', runId })
      return
    }
    throw Errors.internal('Agent 步数过多')
  } catch (error) {
    const problem =
      error instanceof AppError
        ? { title: error.title, detail: error.detail, code: error.code }
        : { title: 'Agent 失败', detail: error instanceof Error ? error.message : 'unknown', code: 'AGENT_FAILED' }
    db.update(agentRuns)
      .set({ status: 'failed', errorJson: JSON.stringify(problem), updatedAt: nowIso() })
      .where(eq(agentRuns.id, runId))
      .run()
    yield pushEvent(runId, { type: 'run.failed', runId, error: problem })
  }
}

const StartRunRequestSchema = z.strictObject({ message: z.string().trim().min(1).max(4000) }).openapi('StartAgentRunRequest')
const AgentEventSchema = z
  .object({
    type: z.string(),
  })
  .passthrough()
  .openapi('AgentEvent')

const AgentRunResponseSchema = z
  .strictObject({
    id: z.string(),
    status: z.enum(['running', 'completed', 'failed']),
    message: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    events: z.array(AgentEventSchema),
  })
  .openapi('AgentRun')

function toRun(row: typeof agentRuns.$inferSelect) {
  return {
    id: row.id,
    status: row.status as 'running' | 'completed' | 'failed',
    message: row.message,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    events: eventLog.get(row.id) ?? [],
  }
}

function requirePerm(identity: RequestIdentity, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(identity, permission)) throw Errors.forbidden()
}

const ProviderIdSchema = z.enum(MODEL_PROVIDER_IDS).openapi('AgentModelProviderId')

const AgentModelProviderSchema = z
  .strictObject({
    id: ProviderIdSchema,
    label: z.string(),
    protocol: z.string(),
    defaultModel: z.string(),
    defaultBaseUrl: z.string(),
    suggestedModels: z.array(z.string()),
    requiresApiKey: z.boolean(),
  })
  .openapi('AgentModelProvider')

const AgentModelResponseSchema = z
  .strictObject({
    requestedProvider: ProviderIdSchema,
    activeProvider: ProviderIdSchema,
    usingFallback: z.boolean(),
    fallbackReason: z.enum(['missing_api_key', 'missing_base_url', 'missing_model']).nullable(),
    model: z.string(),
    baseUrl: z.string(),
    hasApiKey: z.boolean(),
    apiKeySource: z.enum(['household', 'env', 'none']),
    source: z.enum(['household', 'env']),
    canConfigure: z.boolean(),
    providers: z.array(AgentModelProviderSchema),
  })
  .openapi('AgentModel')

const UpdateAgentModelRequestSchema = z
  .strictObject({
    provider: ProviderIdSchema,
    model: z.string().trim().min(1).max(120).nullable().optional(),
    baseUrl: z.string().trim().max(500).nullable().optional(),
    apiKey: z.string().max(500).nullable().optional(),
  })
  .openapi('UpdateAgentModelRequest')

export function agentRoutes() {
  const routes = createRouter()

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/agent/runs',
      tags: ['Agent'],
      request: { body: jsonContent(StartRunRequestSchema, '开始一轮对话') },
      responses: {
        200: jsonContent(AgentRunResponseSchema, '已创建（非流式）'),
        201: jsonContent(AgentRunResponseSchema, '已创建'),
        ...errorResponses,
      },
    }),
    async (c) => {
      const identity = c.get('identity')
      requirePerm(identity, 'agent:run')
      const body = c.req.valid('json')
      const db = c.get('db')
      const at = nowIso()
      const runId = createId('run')
      db.insert(agentRuns)
        .values({
          id: runId,
          householdId: identity.householdId,
          accountId: identity.accountId,
          status: 'running',
          message: body.message,
          errorJson: null,
          createdAt: at,
          updatedAt: at,
        })
        .run()
      const accept = c.req.header('Accept') ?? ''
      if (accept.includes('text/event-stream')) {
        return streamSSE(c, async (stream) => {
          for await (const event of runAgent({
            db,
            env: c.get('env'),
            identity,
            requestId: c.get('requestId'),
            message: body.message,
            runId,
          })) {
            await stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
          }
        })
      }
      for await (const _event of runAgent({
        db,
        env: c.get('env'),
        identity,
        requestId: c.get('requestId'),
        message: body.message,
        runId,
      })) {
        // drain
      }
      const row = db.select().from(agentRuns).where(eq(agentRuns.id, runId)).get()!
      return c.json(toRun(row), 201)
    },
  )

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/agent/runs/{runId}',
      tags: ['Agent'],
      request: {
        params: z.strictObject({
          runId: z.string().openapi({ param: { name: 'runId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(AgentRunResponseSchema, 'Run'), ...errorResponses },
    }),
    (c) => {
      const identity = c.get('identity')
      requirePerm(identity, 'agent:run')
      const runId = c.req.valid('param').runId
      const row = c
        .get('db')
        .select()
        .from(agentRuns)
        .where(and(eq(agentRuns.id, runId), eq(agentRuns.householdId, identity.householdId)))
        .get()
      if (!row) throw Errors.notFound('对话不存在', '找不到该 Agent Run')
      return c.json(toRun(row), 200)
    },
  )

  routes.get('/agent/runs/:runId/events', async (c) => {
    const identity = c.get('identity')
    requirePerm(identity, 'agent:run')
    const runId = c.req.param('runId')
    const row = c
      .get('db')
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.id, runId), eq(agentRuns.householdId, identity.householdId)))
      .get()
    if (!row) throw Errors.notFound('对话不存在', '找不到该 Agent Run')
    const events = eventLog.get(runId) ?? []
    return streamSSE(c, async (stream) => {
      for (const event of events) {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
      }
      if (row.status !== 'running') {
        await stream.writeSSE({
          event: row.status === 'failed' ? 'run.failed' : 'run.completed',
          data: JSON.stringify(
            row.status === 'failed'
              ? { type: 'run.failed', runId, error: row.errorJson ? JSON.parse(row.errorJson) : {} }
              : { type: 'run.completed', runId },
          ),
        })
      }
    })
  })

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/agent/actions/{actionId}/confirm',
      tags: ['Agent'],
      request: {
        params: z.strictObject({
          actionId: z.string().openapi({ param: { name: 'actionId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(z.object({ status: z.string(), result: z.unknown() }), '已确认'), ...errorResponses },
    }),
    (c) => {
      const identity = c.get('identity')
      requirePerm(identity, 'agent:approve')
      const db = c.get('db')
      const actionId = c.req.valid('param').actionId
      const action = db
        .select()
        .from(agentActions)
        .where(and(eq(agentActions.id, actionId), eq(agentActions.householdId, identity.householdId)))
        .get()
      if (!action) throw Errors.notFound('动作不存在', '找不到待确认动作')
      if (action.status !== 'pending') {
        throw Errors.conflict('ACTION_NOT_PENDING', '动作已处理', '该动作已经确认或拒绝')
      }
      const ctx = agentContext(identity, c.get('requestId'), action.runId, actionId)
      const result = executeTool(db, ctx, action.tool, JSON.parse(action.payloadJson))
      db.update(agentActions)
        .set({ status: 'executed', resolvedAt: nowIso() })
        .where(eq(agentActions.id, actionId))
        .run()
      return c.json({ status: 'executed', result }, 200)
    },
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/agent/actions/{actionId}/reject',
      tags: ['Agent'],
      request: {
        params: z.strictObject({
          actionId: z.string().openapi({ param: { name: 'actionId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(z.object({ status: z.string() }), '已拒绝'), ...errorResponses },
    }),
    (c) => {
      const identity = c.get('identity')
      requirePerm(identity, 'agent:approve')
      const db = c.get('db')
      const actionId = c.req.valid('param').actionId
      const action = db
        .select()
        .from(agentActions)
        .where(and(eq(agentActions.id, actionId), eq(agentActions.householdId, identity.householdId)))
        .get()
      if (!action) throw Errors.notFound('动作不存在', '找不到待确认动作')
      if (action.status !== 'pending') {
        throw Errors.conflict('ACTION_NOT_PENDING', '动作已处理', '该动作已经确认或拒绝')
      }
      db.update(agentActions)
        .set({ status: 'rejected', resolvedAt: nowIso() })
        .where(eq(agentActions.id, actionId))
        .run()
      return c.json({ status: 'rejected' }, 200)
    },
  )

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/agent/model',
      tags: ['Agent'],
      responses: { 200: jsonContent(AgentModelResponseSchema, '当前模型'), ...errorResponses },
    }),
    (c) => {
      const identity = c.get('identity')
      requirePerm(identity, 'agent:run')
      const env = c.get('env')
      const household = readHouseholdOverride(c.get('db'), env, identity.householdId)
      const selection = resolveModelSelection(env, household)
      return c.json(
        {
          requestedProvider: selection.requestedProvider,
          activeProvider: selection.activeProvider,
          usingFallback: selection.usingFallback,
          fallbackReason: selection.fallbackReason,
          model: selection.model,
          baseUrl: selection.baseUrl,
          hasApiKey: selection.hasApiKey,
          apiKeySource: selection.apiKeySource,
          source: selection.source,
          canConfigure: hasPermission(identity, 'agent:configure'),
          providers: listProviderCatalog(),
        },
        200,
      )
    },
  )

  routes.openapi(
    createRoute({
      method: 'put',
      path: '/agent/model',
      tags: ['Agent'],
      request: { body: jsonContent(UpdateAgentModelRequestSchema, '更换模型') },
      responses: { 200: jsonContent(AgentModelResponseSchema, '已保存'), ...errorResponses },
    }),
    (c) => {
      const identity = c.get('identity')
      requirePerm(identity, 'agent:configure')
      const env = c.get('env')
      const db = c.get('db')
      const body = c.req.valid('json')
      if (!isModelProviderId(body.provider)) {
        throw Errors.validation('不支持的模型供应商', [
          { path: ['provider'], code: 'invalid', message: `未知供应商 ${body.provider}` },
        ])
      }
      saveHouseholdAgentModel(db, env, identity.householdId, {
        provider: body.provider,
        model: body.model === undefined ? null : body.model,
        baseUrl: body.baseUrl === undefined ? null : body.baseUrl,
        apiKey: body.apiKey,
      })
      writeAudit(
        db,
        { identity, requestId: c.get('requestId'), source: 'manual' },
        {
          command: 'agent.configureModel',
          entityType: 'household_agent_model',
          entityId: identity.householdId,
          detail: { provider: body.provider, model: body.model ?? null },
        },
      )
      const household = readHouseholdOverride(db, env, identity.householdId)
      const selection = resolveModelSelection(env, household)
      return c.json(
        {
          requestedProvider: selection.requestedProvider,
          activeProvider: selection.activeProvider,
          usingFallback: selection.usingFallback,
          fallbackReason: selection.fallbackReason,
          model: selection.model,
          baseUrl: selection.baseUrl,
          hasApiKey: selection.hasApiKey,
          apiKeySource: selection.apiKeySource,
          source: selection.source,
          canConfigure: true,
          providers: listProviderCatalog(),
        },
        200,
      )
    },
  )

  return routes
}

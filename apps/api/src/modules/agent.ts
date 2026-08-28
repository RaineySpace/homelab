import { and, eq } from 'drizzle-orm'
import { createRoute, z } from '@hono/zod-openapi'
import { createRouter } from '../core/router.js'
import { streamSSE } from 'hono/streaming'
import { agentActions, agentRuns } from '../core/database/schema.js'
import { AppError, Errors } from '../core/errors.js'
import { createId, nowIso } from '../core/ids.js'
import { errorResponses, jsonContent } from '../core/openapi.js'
import { hasPermission } from '../core/permissions.js'
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

type ModelMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

export interface ModelGateway {
  complete(input: { messages: ModelMessage[]; tools: Array<{ name: string; description: string; parameters: unknown }> }): Promise<{
    message: ModelMessage
  }>
}

function jsonSchema(schema: z.ZodType): unknown {
  try {
    return z.toJSONSchema(schema as z.ZodTypeAny)
  } catch {
    return { type: 'object' }
  }
}

export class StubModelGateway implements ModelGateway {
  async complete(input: { messages: ModelMessage[] }) {
    const last = input.messages.at(-1)
    if (last?.role === 'tool') {
      return {
        message: {
          role: 'assistant' as const,
          content: `已经完成工具调用。结果：${last.content}`,
        },
      }
    }
    const user = [...input.messages].reverse().find((item) => item.role === 'user')
    const text = user?.content ?? ''
    const named = text.match(/叫\s*([^\s的，,。！!？?]{1,20})/)
    if (/创建|登记|添加/.test(text) && (/人物|成员|人/.test(text) || named)) {
      const name = named?.[1] ?? '未命名'
      return {
        message: {
          role: 'assistant' as const,
          content: null,
          tool_calls: [
            {
              id: createId('call'),
              function: {
                name: 'people.create',
                arguments: JSON.stringify({ name, birth: null, sex: null }),
              },
            },
          ],
        },
      }
    }
    if (/列出|有哪些/.test(text) && /人/.test(text)) {
      return {
        message: {
          role: 'assistant' as const,
          content: null,
          tool_calls: [{ id: createId('call'), function: { name: 'people.list', arguments: '{}' } }],
        },
      }
    }
    if (/归档/.test(text) && /人/.test(text)) {
      const personId = text.match(/person_[a-z0-9]+/)?.[0]
      if (personId) {
        return {
          message: {
            role: 'assistant' as const,
            content: null,
            tool_calls: [
              {
                id: createId('call'),
                function: { name: 'people.archive', arguments: JSON.stringify({ personId }) },
              },
            ],
          },
        }
      }
    }
    if (/任务/.test(text) && /创建|添加/.test(text)) {
      const title = text.replace(/.*(?:叫|名为|：|:)/, '').trim() || '未命名任务'
      return {
        message: {
          role: 'assistant' as const,
          content: null,
          tool_calls: [
            {
              id: createId('call'),
              function: {
                name: 'tasks.create',
                arguments: JSON.stringify({ title, notes: null, assigneePersonId: null, dueAt: null }),
              },
            },
          ],
        },
      }
    }
    return {
      message: {
        role: 'assistant' as const,
        content: `我是家庭助手。可以说「登记一个叫妈妈的人」或「列出人物」。你刚才说：${text}`,
      },
    }
  }
}

export class DeepSeekModelGateway implements ModelGateway {
  constructor(private env: Env) {}

  async complete(input: {
    messages: ModelMessage[]
    tools: Array<{ name: string; description: string; parameters: unknown }>
  }) {
    const response = await fetch(`${this.env.DEEPSEEK_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: this.env.DEEPSEEK_MODEL,
        messages: input.messages,
        tools: input.tools.map((tool) => ({
          type: 'function',
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        })),
      }),
    })
    if (!response.ok) {
      const detail = await response.text()
      throw Errors.internal(`DeepSeek 调用失败：${response.status} ${detail.slice(0, 300)}`)
    }
    const json = (await response.json()) as {
      choices: Array<{ message: ModelMessage }>
    }
    const message = json.choices[0]?.message
    if (!message) throw Errors.internal('DeepSeek 没有返回消息')
    return { message }
  }
}

export function createModelGateway(env: Env): ModelGateway {
  if (env.DEEPSEEK_API_KEY) return new DeepSeekModelGateway(env)
  return new StubModelGateway()
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
  const gateway = createModelGateway(env)
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

  return routes
}

import { and, desc, eq } from 'drizzle-orm'
import { createRoute, z } from '@hono/zod-openapi'
import { accounts, auditEvents, people, sessions } from '../core/database/schema.js'
import { createRouter } from '../core/router.js'
import { createId, nowIso } from '../core/ids.js'
import { hashPassword } from '../core/crypto.js'
import { Errors } from '../core/errors.js'
import { errorResponses, jsonContent } from '../core/openapi.js'
import { hasPermission } from '../core/permissions.js'
import { writeAudit } from '../core/audit.js'
import { PartialBirthDateSchema, SexSchema } from '../core/dates.js'
import type { CommandContext } from '../core/context.js'
import type { Db } from '../core/database/client.js'

const PasswordSchema = z.string().min(12).max(200)

const PersonSummarySchema = z.strictObject({ id: z.string(), name: z.string() })

const AccountResponseSchema = z
  .strictObject({
    id: z.string(),
    username: z.string(),
    role: z.enum(['owner', 'member', 'viewer']),
    person: PersonSummarySchema.nullable(),
    disabledAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Account')

const PersonSourceSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('existing'), personId: z.string().min(1) }),
  z.strictObject({
    type: z.literal('new'),
    name: z.string().trim().min(1).max(50),
    birth: PartialBirthDateSchema.nullable(),
    sex: SexSchema.nullable(),
  }),
])

const CreateAccountRequestSchema = z
  .strictObject({
    username: z.string().trim().min(1).max(80),
    password: PasswordSchema,
    role: z.enum(['member', 'viewer']),
    person: PersonSourceSchema,
  })
  .openapi('CreateAccountRequest')

const UpdateAccountRequestSchema = z
  .strictObject({
    username: z.string().trim().min(1).max(80).optional(),
    personId: z.string().min(1).optional(),
    role: z.enum(['member', 'viewer']).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, { message: '至少提供一个要修改的字段' })
  .openapi('UpdateAccountRequest')

const ResetPasswordRequestSchema = z
  .strictObject({ newPassword: PasswordSchema })
  .openapi('ResetAccountPasswordRequest')

const AccountIdParam = z.strictObject({
  accountId: z.string().min(1).openapi({ param: { name: 'accountId', in: 'path' } }),
})

type AccountRow = {
  id: string
  username: string
  role: string
  personId: string | null
  personName: string | null
  disabledAt: string | null
  createdAt: string
  updatedAt: string
}

function toAccount(row: AccountRow) {
  return {
    id: row.id,
    username: row.username,
    role: row.role as 'owner' | 'member' | 'viewer',
    person: row.personId && row.personName ? { id: row.personId, name: row.personName } : null,
    disabledAt: row.disabledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function requireAccountPermission(ctx: CommandContext, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(ctx.identity, permission)) throw Errors.forbidden()
}

function accountRow(db: Db, householdId: string, accountId: string): AccountRow | undefined {
  return db
    .select({
      id: accounts.id,
      username: accounts.username,
      role: accounts.role,
      personId: accounts.personId,
      personName: people.name,
      disabledAt: accounts.disabledAt,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .leftJoin(people, eq(people.id, accounts.personId))
    .where(and(eq(accounts.id, accountId), eq(accounts.householdId, householdId)))
    .get()
}

function getAccountOrThrow(db: Db, householdId: string, accountId: string) {
  const row = accountRow(db, householdId, accountId)
  if (!row) throw Errors.notFound('账号不存在', '找不到该家庭账号')
  return row
}

function assertUsernameAvailable(db: Db, username: string, excludingId?: string) {
  const existing = db.select({ id: accounts.id }).from(accounts).where(eq(accounts.username, username)).get()
  if (existing && existing.id !== excludingId) {
    throw Errors.conflict('ACCOUNT_USERNAME_CONFLICT', '用户名已存在', '请使用其他用户名')
  }
}

function assertPersonAvailable(db: Db, householdId: string, personId: string, excludingAccountId?: string) {
  const person = db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.householdId, householdId)))
    .get()
  if (!person) throw Errors.notFound('人物不存在', '找不到该家庭人物')
  if (person.archivedAt) {
    throw Errors.conflict('ACCOUNT_PERSON_ARCHIVED', '人物已归档', '账号只能关联未归档的家庭人物')
  }
  const linked = db.select({ id: accounts.id }).from(accounts).where(eq(accounts.personId, personId)).get()
  if (linked && linked.id !== excludingAccountId) {
    throw Errors.conflict('ACCOUNT_PERSON_CONFLICT', '人物已绑定账号', '一个家庭人物只能关联一个账号')
  }
  return person
}

function commandCtx(c: { get: (key: 'identity' | 'requestId') => unknown }): CommandContext {
  return {
    identity: c.get('identity') as CommandContext['identity'],
    requestId: c.get('requestId') as string,
    source: 'manual',
  }
}

export function listAccountsCommand(db: Db, ctx: CommandContext) {
  requireAccountPermission(ctx, 'accounts:read')
  return db
    .select({
      id: accounts.id,
      username: accounts.username,
      role: accounts.role,
      personId: accounts.personId,
      personName: people.name,
      disabledAt: accounts.disabledAt,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .leftJoin(people, eq(people.id, accounts.personId))
    .where(eq(accounts.householdId, ctx.identity.householdId))
    .orderBy(desc(accounts.createdAt))
    .all()
    .map(toAccount)
}

export function createAccountCommand(
  db: Db,
  ctx: CommandContext,
  input: z.infer<typeof CreateAccountRequestSchema>,
) {
  requireAccountPermission(ctx, 'accounts:create')
  assertUsernameAvailable(db, input.username)
  if (input.person.type === 'existing') {
    assertPersonAvailable(db, ctx.identity.householdId, input.person.personId)
  }
  const at = nowIso()
  const accountId = createId('acct')
  const personId = input.person.type === 'existing' ? input.person.personId : createId('person')
  db.transaction((tx) => {
    if (input.person.type === 'new') {
      tx.insert(people)
        .values({
          id: personId,
          householdId: ctx.identity.householdId,
          name: input.person.name,
          sex: input.person.sex,
          birthYear: input.person.birth?.year ?? null,
          birthMonth: input.person.birth?.month ?? null,
          birthDay: input.person.birth?.day ?? null,
          version: 1,
          archivedAt: null,
          createdAt: at,
          updatedAt: at,
        })
        .run()
    }
    tx.insert(accounts)
      .values({
        id: accountId,
        householdId: ctx.identity.householdId,
        personId,
        username: input.username,
        passwordHash: hashPassword(input.password),
        role: input.role,
        disabledAt: null,
        createdAt: at,
        updatedAt: at,
      })
      .run()
  })
  if (input.person.type === 'new') {
    writeAudit(db, ctx, { command: 'people.create', entityType: 'person', entityId: personId })
  }
  writeAudit(db, ctx, {
    command: 'accounts.create',
    entityType: 'account',
    entityId: accountId,
    detail: { role: input.role, personId },
  })
  return toAccount(getAccountOrThrow(db, ctx.identity.householdId, accountId))
}

export function updateAccountCommand(
  db: Db,
  ctx: CommandContext,
  accountId: string,
  input: z.infer<typeof UpdateAccountRequestSchema>,
) {
  requireAccountPermission(ctx, 'accounts:update')
  const current = getAccountOrThrow(db, ctx.identity.householdId, accountId)
  if (input.username !== undefined) assertUsernameAvailable(db, input.username, accountId)
  if (input.personId !== undefined) {
    assertPersonAvailable(db, ctx.identity.householdId, input.personId, accountId)
  }
  if (current.role === 'owner' && input.role !== undefined) {
    throw Errors.conflict('OWNER_ROLE_PROTECTED', '不能修改 owner 角色', '系统必须保留唯一 owner')
  }
  const roleChanged = input.role !== undefined && input.role !== current.role
  const at = nowIso()
  db.transaction((tx) => {
    tx.update(accounts)
      .set({
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.personId !== undefined ? { personId: input.personId } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        updatedAt: at,
      })
      .where(eq(accounts.id, accountId))
      .run()
    if (roleChanged) tx.delete(sessions).where(eq(sessions.accountId, accountId)).run()
  })
  writeAudit(db, ctx, {
    command: 'accounts.update',
    entityType: 'account',
    entityId: accountId,
    detail: {
      ...(input.username !== undefined ? { usernameChanged: input.username !== current.username } : {}),
      ...(input.personId !== undefined ? { personId: input.personId } : {}),
    },
  })
  if (roleChanged) {
    writeAudit(db, ctx, {
      command: 'accounts.role_change',
      entityType: 'account',
      entityId: accountId,
      detail: { from: current.role, to: input.role },
    })
  }
  return toAccount(getAccountOrThrow(db, ctx.identity.householdId, accountId))
}

export function resetAccountPasswordCommand(
  db: Db,
  ctx: CommandContext,
  accountId: string,
  newPassword: string,
) {
  requireAccountPermission(ctx, 'accounts:reset-password')
  const target = getAccountOrThrow(db, ctx.identity.householdId, accountId)
  if (target.role === 'owner') {
    throw Errors.conflict('OWNER_ACCOUNT_PROTECTED', '不能重置 owner 密码', '请使用修改自己密码或恢复命令')
  }
  db.transaction((tx) => {
    tx.update(accounts)
      .set({ passwordHash: hashPassword(newPassword), updatedAt: nowIso() })
      .where(eq(accounts.id, accountId))
      .run()
    tx.delete(sessions).where(eq(sessions.accountId, accountId)).run()
  })
  writeAudit(db, ctx, { command: 'accounts.password_reset', entityType: 'account', entityId: accountId })
}

export function disableAccountCommand(db: Db, ctx: CommandContext, accountId: string) {
  requireAccountPermission(ctx, 'accounts:disable')
  const target = getAccountOrThrow(db, ctx.identity.householdId, accountId)
  if (target.role === 'owner') {
    throw Errors.conflict('OWNER_ACCOUNT_PROTECTED', '不能停用 owner', '系统必须保留一个可登录的 owner')
  }
  if (target.disabledAt) return toAccount(target)
  const at = nowIso()
  db.transaction((tx) => {
    tx.update(accounts).set({ disabledAt: at, updatedAt: at }).where(eq(accounts.id, accountId)).run()
    tx.delete(sessions).where(eq(sessions.accountId, accountId)).run()
  })
  writeAudit(db, ctx, { command: 'accounts.disable', entityType: 'account', entityId: accountId })
  return toAccount(getAccountOrThrow(db, ctx.identity.householdId, accountId))
}

export function enableAccountCommand(db: Db, ctx: CommandContext, accountId: string) {
  requireAccountPermission(ctx, 'accounts:disable')
  const target = getAccountOrThrow(db, ctx.identity.householdId, accountId)
  if (target.role === 'owner') {
    throw Errors.conflict('OWNER_ACCOUNT_PROTECTED', '不能变更 owner 状态', 'owner 始终保持启用')
  }
  if (!target.personId) {
    throw Errors.conflict('ACCOUNT_PERSON_REQUIRED', '账号未关联人物', '请先关联家庭人物')
  }
  assertPersonAvailable(db, ctx.identity.householdId, target.personId, accountId)
  if (!target.disabledAt) return toAccount(target)
  db.update(accounts).set({ disabledAt: null, updatedAt: nowIso() }).where(eq(accounts.id, accountId)).run()
  writeAudit(db, ctx, { command: 'accounts.enable', entityType: 'account', entityId: accountId })
  return toAccount(getAccountOrThrow(db, ctx.identity.householdId, accountId))
}

export function resetOwnerPassword(db: Db, newPassword: string) {
  if (newPassword.length < 12 || newPassword.length > 200) {
    throw new Error('密码长度必须为 12–200 个字符')
  }
  const owners = db.select().from(accounts).where(eq(accounts.role, 'owner')).all()
  if (owners.length !== 1) throw new Error(`数据库必须且只能存在一个 owner，当前为 ${owners.length} 个`)
  const owner = owners[0]!
  const at = nowIso()
  db.transaction((tx) => {
    tx.update(accounts)
      .set({ passwordHash: hashPassword(newPassword), updatedAt: at })
      .where(eq(accounts.id, owner.id))
      .run()
    tx.delete(sessions).where(eq(sessions.accountId, owner.id)).run()
    tx.insert(auditEvents)
      .values({
        id: createId('audit'),
        householdId: owner.householdId,
        actorAccountId: owner.id,
        source: 'manual',
        command: 'auth.owner_password_recovered',
        entityType: 'account',
        entityId: owner.id,
        detailJson: JSON.stringify({ recovery: true }),
        createdAt: at,
      })
      .run()
  })
  return owner.id
}

export function accountRoutes() {
  const routes = createRouter()

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/accounts',
      tags: ['Accounts'],
      responses: { 200: jsonContent(z.array(AccountResponseSchema), '账号列表'), ...errorResponses },
    }),
    (c) => c.json(listAccountsCommand(c.get('db'), commandCtx(c)), 200),
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/accounts',
      tags: ['Accounts'],
      request: { body: jsonContent(CreateAccountRequestSchema, '创建普通账号') },
      responses: { 201: jsonContent(AccountResponseSchema, '已创建'), ...errorResponses },
    }),
    (c) => c.json(createAccountCommand(c.get('db'), commandCtx(c), c.req.valid('json')), 201),
  )

  routes.openapi(
    createRoute({
      method: 'patch',
      path: '/accounts/{accountId}',
      tags: ['Accounts'],
      request: { params: AccountIdParam, body: jsonContent(UpdateAccountRequestSchema, '修改账号') },
      responses: { 200: jsonContent(AccountResponseSchema, '已修改'), ...errorResponses },
    }),
    (c) =>
      c.json(
        updateAccountCommand(c.get('db'), commandCtx(c), c.req.valid('param').accountId, c.req.valid('json')),
        200,
      ),
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/accounts/{accountId}/password/reset',
      tags: ['Accounts'],
      request: { params: AccountIdParam, body: jsonContent(ResetPasswordRequestSchema, '重置普通账号密码') },
      responses: { 204: { description: '密码已重置' }, ...errorResponses },
    }),
    (c) => {
      resetAccountPasswordCommand(
        c.get('db'),
        commandCtx(c),
        c.req.valid('param').accountId,
        c.req.valid('json').newPassword,
      )
      return c.body(null, 204)
    },
  )

  for (const action of ['disable', 'enable'] as const) {
    routes.openapi(
      createRoute({
        method: 'post',
        path: `/accounts/{accountId}/${action}`,
        tags: ['Accounts'],
        request: { params: AccountIdParam },
        responses: { 200: jsonContent(AccountResponseSchema, action === 'disable' ? '已停用' : '已启用'), ...errorResponses },
      }),
      (c) => {
        const accountId = c.req.valid('param').accountId
        const account =
          action === 'disable'
            ? disableAccountCommand(c.get('db'), commandCtx(c), accountId)
            : enableAccountCommand(c.get('db'), commandCtx(c), accountId)
        return c.json(account, 200)
      },
    )
  }

  return routes
}

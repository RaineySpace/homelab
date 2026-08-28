import { createHash } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { createRoute, z } from '@hono/zod-openapi'
import { createRouter } from '../core/router.js'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { accounts, sessions } from '../core/database/schema.js'
import { createId, nowIso } from '../core/ids.js'
import { hashToken, randomToken, verifyPassword } from '../core/crypto.js'
import { Errors } from '../core/errors.js'
import { errorResponses, jsonContent } from '../core/openapi.js'
import { permissionsForRole, type RequestIdentity, type Role } from '../core/permissions.js'
import type { Db } from '../core/database/client.js'
import type { Env } from '../env.js'

export const COOKIE_NAME = 'family_os_session'

const LoginRequestSchema = z
  .strictObject({
    username: z.string().trim().min(1).max(80),
    password: z.string().min(1).max(200),
  })
  .openapi('LoginRequest')

const SessionResponseSchema = z
  .strictObject({
    accountId: z.string(),
    householdId: z.string(),
    username: z.string(),
    role: z.enum(['owner', 'member', 'viewer']),
    permissions: z.array(z.string()),
    authMethod: z.enum(['cookie', 'bearer']),
  })
  .openapi('SessionResponse')

export function createSession(db: Db, accountId: string, ttlDays: number) {
  const token = randomToken()
  const at = nowIso()
  const expires = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString()
  const sessionId = createId('sess')
  db.insert(sessions)
    .values({
      id: sessionId,
      accountId,
      tokenHash: hashToken(token),
      expiresAt: expires,
      createdAt: at,
    })
    .run()
  return { token, sessionId, expiresAt: expires }
}

export function identityFromToken(
  db: Db,
  token: string,
  authMethod: RequestIdentity['authMethod'],
): RequestIdentity | null {
  const tokenHash = hashToken(token)
  const row = db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      accountId: accounts.id,
      householdId: accounts.householdId,
      username: accounts.username,
      role: accounts.role,
    })
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, nowIso())))
    .get()
  if (!row) return null
  const role = row.role as Role
  return {
    accountId: row.accountId,
    householdId: row.householdId,
    sessionId: row.sessionId,
    username: row.username,
    role,
    permissions: permissionsForRole(role),
    authMethod,
  }
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null
  const [type, token] = header.split(' ')
  if (type?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export function resolveIdentity(db: Db, cookieToken: string | undefined, authorization: string | undefined) {
  if (cookieToken) {
    const identity = identityFromToken(db, cookieToken, 'cookie')
    if (identity) return identity
  }
  const token = bearerToken(authorization)
  if (token) return identityFromToken(db, token, 'bearer')
  return null
}

export function isPublicPath(path: string): boolean {
  return (
    path === '/health' ||
    path === '/openapi.json' ||
    path.startsWith('/doc') ||
    path === '/auth/login'
  )
}

function toSession(identity: RequestIdentity) {
  return {
    accountId: identity.accountId,
    householdId: identity.householdId,
    username: identity.username,
    role: identity.role,
    permissions: identity.permissions,
    authMethod: identity.authMethod,
  }
}

export function identityRoutes() {
  const routes = createRouter()

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/auth/login',
      tags: ['Identity'],
      request: {
        body: jsonContent(LoginRequestSchema, '登录'),
      },
      responses: {
        200: jsonContent(SessionResponseSchema, '登录成功'),
        401: errorResponses[401],
        422: errorResponses[422],
      },
    }),
    (c) => {
      const body = c.req.valid('json')
      const db = c.get('db')
      const env = c.get('env') as Env
      const account = db.select().from(accounts).where(eq(accounts.username, body.username)).get()
      if (!account || !verifyPassword(body.password, account.passwordHash)) {
        throw Errors.unauthorized()
      }
      const session = createSession(db, account.id, env.SESSION_TTL_DAYS)
      setCookie(c, COOKIE_NAME, session.token, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        secure: env.COOKIE_SECURE,
        expires: new Date(session.expiresAt),
      })
      const identity = identityFromToken(db, session.token, 'cookie')
      if (!identity) throw Errors.internal()
      return c.json(toSession(identity), 200)
    },
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/auth/logout',
      tags: ['Identity'],
      responses: {
        204: { description: '已登出' },
        401: errorResponses[401],
      },
    }),
    (c) => {
      const identity = c.get('identity')
      const db = c.get('db')
      db.delete(sessions).where(eq(sessions.id, identity.sessionId)).run()
      deleteCookie(c, COOKIE_NAME, { path: '/' })
      return c.body(null, 204)
    },
  )

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/auth/session',
      tags: ['Identity'],
      responses: {
        200: jsonContent(SessionResponseSchema, '当前会话'),
        401: errorResponses[401],
      },
    }),
    (c) => c.json(toSession(c.get('identity')), 200),
  )

  return routes
}

export function csrfSafeHash(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 12)
}

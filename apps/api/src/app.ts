import { OpenAPIHono } from '@hono/zod-openapi'
import { createId } from './core/ids.js'
import { Errors } from './core/errors.js'
import { handleError } from './core/http.js'
import { isPublicPath, resolveIdentity, COOKIE_NAME } from './modules/identity.js'
import { getCookie } from 'hono/cookie'
import { healthRoutes } from './modules/health.js'
import { identityRoutes } from './modules/identity.js'
import { peopleRoutes } from './modules/people.js'
import { recipeRoutes } from './modules/recipes.js'
import { mealRoutes } from './modules/meals.js'
import { taskRoutes } from './modules/tasks.js'
import { agentRoutes } from './modules/agent.js'
import type { AppEnv } from './app-env.js'
import type { Db } from './core/database/client.js'
import type { Env } from './env.js'

export function createApp(options: { env: Env; db: Db }) {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issues = 'error' in result ? result.error.issues : []
        throw Errors.validation(
          '请求参数校验失败',
          issues.map((issue) => ({
            path: [...issue.path],
            code: String(issue.code),
            message: issue.message,
          })),
        )
      }
    },
  })

  app.use('*', async (c, next) => {
    const requestId = c.req.header('x-request-id') ?? createId('req')
    c.set('requestId', requestId)
    c.set('db', options.db)
    c.set('env', options.env)
    c.header('x-request-id', requestId)
    await next()
  })

  app.use('*', async (c, next) => {
    const path = c.req.path.replace(/^\/api\/v1/, '') || '/'
    if (isPublicPath(path)) {
      await next()
      return
    }
    const identity = resolveIdentity(
      options.db,
      getCookie(c, COOKIE_NAME),
      c.req.header('authorization'),
    )
    if (!identity) throw Errors.unauthorized()
    c.set('identity', identity)
    await next()
  })

  app.onError((error, c) => handleError(error, c))

  const v1 = new OpenAPIHono<AppEnv>()
  v1.route('/', healthRoutes())
  v1.route('/', identityRoutes())
  v1.route('/', peopleRoutes())
  v1.route('/', recipeRoutes())
  v1.route('/', mealRoutes())
  v1.route('/', taskRoutes())
  v1.route('/', agentRoutes())
  v1.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Family OS API',
      version: '1.0.0',
      description: '家庭操作系统的稳定 HTTP 契约。Web 与未来多端都消费这一份 OpenAPI。',
    },
    tags: [
      { name: 'Meta' },
      { name: 'Identity' },
      { name: 'People' },
      { name: 'Recipes' },
      { name: 'Meals' },
      { name: 'Tasks' },
      { name: 'Agent' },
    ],
  })

  app.route('/api/v1', v1)
  return app
}

export type FamilyApp = ReturnType<typeof createApp>

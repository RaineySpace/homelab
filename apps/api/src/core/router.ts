import { OpenAPIHono } from '@hono/zod-openapi'
import { Errors } from './errors.js'
import type { AppEnv } from '../app-env.js'

export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) {
        throw Errors.validation(
          '请求参数校验失败',
          result.error.issues.map((issue) => ({
            path: issue.path.map((segment) => (typeof segment === 'symbol' ? String(segment) : segment)),
            code: String(issue.code),
            message: issue.message,
          })),
        )
      }
    },
  })
}

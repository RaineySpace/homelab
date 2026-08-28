import { createRoute, z } from '@hono/zod-openapi'
import { jsonContent } from '../core/openapi.js'
import { createRouter } from '../core/router.js'

const HealthSchema = z.strictObject({ status: z.literal('ok') }).openapi('Health')

export function healthRoutes() {
  const routes = createRouter()
  routes.openapi(
    createRoute({
      method: 'get',
      path: '/health',
      tags: ['Meta'],
      responses: { 200: jsonContent(HealthSchema, '健康检查') },
    }),
    (c) => c.json({ status: 'ok' as const }, 200),
  )
  return routes
}

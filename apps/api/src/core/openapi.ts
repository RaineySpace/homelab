import { z } from '@hono/zod-openapi'

export const ProblemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    code: z.string(),
    detail: z.string(),
    instance: z.string(),
    requestId: z.string(),
    errors: z
      .array(
        z.object({
          path: z.array(z.union([z.string(), z.number()])),
          code: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
  })
  .openapi('Problem')

export function jsonContent<T extends z.ZodType>(schema: T, description: string) {
  return {
    content: {
      'application/json': { schema },
    },
    description,
  }
}

export function problemContent(description: string) {
  return {
    content: {
      'application/problem+json': { schema: ProblemSchema },
    },
    description,
  }
}

export const errorResponses = {
  401: problemContent('未登录'),
  403: problemContent('没有权限'),
  404: problemContent('不存在'),
  409: problemContent('冲突'),
  422: problemContent('校验失败'),
  500: problemContent('服务器错误'),
}

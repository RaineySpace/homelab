import type { Context } from 'hono'
import { AppError, Errors, type ProblemBody } from './errors.js'

export function sendProblem(c: Context, error: AppError) {
  const requestId = c.get('requestId') as string
  const body: ProblemBody = error.toProblem(c.req.path, requestId)
  return c.json(body, error.status as 400, {
    'Content-Type': 'application/problem+json',
  })
}

export function handleError(error: unknown, c: Context) {
  if (error instanceof AppError) return sendProblem(c, error)
  console.error(error)
  return sendProblem(c, Errors.internal())
}

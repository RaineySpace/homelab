type Problem = {
  title?: string
  detail?: string
  code?: string
  status?: number
  errors?: Array<{ path: Array<string | number>; message: string }>
}

export class ApiProblem extends Error {
  constructor(public problem: Problem) {
    super(problem.detail ?? problem.title ?? '请求失败')
  }
}

async function parse(response: Response) {
  if (response.status === 204) return undefined
  const text = await response.text()
  return text ? JSON.parse(text) : undefined
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
  if (response.status === 401 && !path.startsWith('/auth/')) {
    window.location.href = '/login'
    throw new ApiProblem({ status: 401, title: '未登录', detail: '请先登录' })
  }
  const body = await parse(response)
  if (!response.ok) throw new ApiProblem(body ?? { status: response.status, title: '请求失败' })
  return body as T
}

export function problemMessage(error: unknown): string {
  if (error instanceof ApiProblem) {
    const field = error.problem.errors?.[0]?.message
    return field ? `${error.problem.detail ?? error.problem.title}：${field}` : (error.problem.detail ?? error.message)
  }
  if (error instanceof Error) return error.message
  return '未知错误'
}

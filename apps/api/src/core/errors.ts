export type FieldError = {
  path: Array<string | number>
  code: string
  message: string
}

export type ProblemBody = {
  type: string
  title: string
  status: number
  code: string
  detail: string
  instance: string
  requestId: string
  errors?: FieldError[]
}

type AppErrorInit = {
  status: number
  code: string
  title: string
  detail: string
  type?: string
  errors?: FieldError[]
}

export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly title: string
  readonly detail: string
  readonly type: string
  readonly errors?: FieldError[]

  constructor(init: AppErrorInit) {
    super(init.detail)
    this.name = 'AppError'
    this.status = init.status
    this.code = init.code
    this.title = init.title
    this.detail = init.detail
    this.type = init.type ?? `https://family.example.com/problems/${slug(init.code)}`
    this.errors = init.errors
  }

  toProblem(instance: string, requestId: string): ProblemBody {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      code: this.code,
      detail: this.detail,
      instance,
      requestId,
      ...(this.errors ? { errors: this.errors } : {}),
    }
  }
}

function slug(code: string): string {
  return code.toLowerCase().replaceAll('_', '-')
}

export const Errors = {
  unauthorized: () =>
    new AppError({
      status: 401,
      code: 'UNAUTHORIZED',
      title: '未登录',
      detail: '请先登录',
    }),
  forbidden: () =>
    new AppError({
      status: 403,
      code: 'FORBIDDEN',
      title: '没有权限',
      detail: '当前身份不能执行该操作',
    }),
  notFound: (title = '资源不存在', detail = '找不到请求的数据') =>
    new AppError({ status: 404, code: 'NOT_FOUND', title, detail }),
  conflict: (code: string, title: string, detail: string) =>
    new AppError({ status: 409, code, title, detail }),
  validation: (detail: string, errors: FieldError[], code = 'VALIDATION_ERROR') =>
    new AppError({
      status: 422,
      code,
      title: '请求参数校验失败',
      detail,
      errors,
    }),
  internal: (detail = '服务器内部错误') =>
    new AppError({
      status: 500,
      code: 'INTERNAL_ERROR',
      title: '服务器错误',
      detail,
    }),
}

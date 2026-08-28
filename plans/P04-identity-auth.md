# P04 身份认证与家庭上下文

- 状态：已完成
- 分类：后端
- 依赖：P03

## 目标

Cookie 会话 + `RequestIdentity` + 引导 owner 账号。业务只看 permissions。

## 验收

- [x] 无账号时按环境变量引导创建家庭与 owner
- [x] 登录设置 HttpOnly Cookie
- [x] 未登录访问受保护资源 401
- [x] 错误密码 401，不泄露用户是否存在的细节可接受（统一文案）
- [x] 登出后会话失效

## 证据

- `src/health-auth.test.ts` 覆盖登录、401、错误密码、登出
- 本地 `POST /api/v1/auth/login` 返回 `Set-Cookie: family_os_session=...; HttpOnly; SameSite=Lax`

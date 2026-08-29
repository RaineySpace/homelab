# P04 身份认证与家庭上下文

- 状态：已完成
- 分类：后端
- 依赖：P03

## 目标

Cookie 会话 + `RequestIdentity` + 单 owner 账号管理。业务只看 permissions。

## 验收

- [x] 无账号时按环境变量引导创建家庭与 owner
- [x] 登录设置 HttpOnly Cookie
- [x] 未登录访问受保护资源 401
- [x] 错误密码 401，不泄露用户是否存在的细节可接受（统一文案）
- [x] 登出后会话失效
- [x] owner 可创建、修改、重置、停用和启用 member/viewer
- [x] 启用账号与家庭人物一对一，角色变更、重置和停用立即撤销会话
- [x] 所有用户可验证当前密码后修改自己的密码
- [x] 交互式恢复命令可重置唯一 owner 并撤销其会话

## 证据

- `src/health-auth.test.ts` 与 `src/accounts.test.ts` 覆盖登录、权限、人物绑定、密码和会话撤销
- 本地 `POST /api/v1/auth/login` 返回 `Set-Cookie: family_os_session=...; HttpOnly; SameSite=Lax`

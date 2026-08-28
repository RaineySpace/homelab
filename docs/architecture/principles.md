# 核心原则

这些原则高于局部便利。实现计划不得为了“先跑起来”而破坏它们。

## 1. OpenAPI 是唯一稳定边界

- 开发时用 Zod 定义输入输出。
- 对外正式契约是生成的 `openapi/openapi.json`。
- 客户端不导入 Hono 服务端代码，不把 Hono RPC / `AppType` 当正式契约。
- 未来微信小程序、原生 App、其他语言客户端都消费同一份 OpenAPI。

## 2. SQLite 只有一个所有者

| 访问者 | 是否允许打开 app.db |
| --- | --- |
| Hono API | 是 |
| 同机 Worker | 必要时可以 |
| 备份进程 | 只能用 Online Backup / `VACUUM INTO` |
| Next.js | 否 |
| 浏览器 | 否 |
| 未来移动端 | 否 |

禁止把数据库放在 NFS、多实例同时挂载、Serverless 临时盘，或运行时 `cp` 一个 WAL 数据库当备份。

## 3. HTTP 与 Agent 必须汇合到同一 Command

```text
表单 POST /people  ─┐
                     ├─► CreatePersonCommand ► ApplicationService ► Repository
Agent tool people.create ─┘
```

禁止：

- 页面走 Service，Agent 直接打 Drizzle。
- 暴露 `POST /entities` 这种通用写入口。
- 在 Route Handler 里堆业务规则。

每个业务动作都有明确命令名，例如 `people.create`、`meals.confirm`。

## 4. Schema 必须分层

同一份数据库行不得同时充当：

- 数据库表
- API 请求
- API 响应
- Agent 工具参数
- 前端表单

至少分成 Transport / Command / Domain / Persistence 四层。响应不得 `return c.json(databaseRow)`。

## 5. 客户端不能自报身份上下文

下列字段只能由服务端从会话写入 Command：

- `householdId`
- `actorAccountId`
- `agentRunId`
- 权限角色
- 创建时间
- 实体版本（更新时客户端提交当前版本，但新版本由服务端计算）

## 6. 业务代码只看权限，不看认证方式

中间件把 Cookie 或 Bearer 都变成同一个 `RequestIdentity`。Service 只判断 `permissions`，不判断 `hasCookie`。

## 7. 写操作默认可重试、可冲突

- 创建类操作支持 `Idempotency-Key`。
- 更新实体带 `version`，冲突返回 `409 ENTITY_VERSION_CONFLICT`。
- 删除默认归档，不物理删除。

## 8. Hono 只做 HTTP，不做家庭事实

Hono 承担：路由、上下文、认证中间件、校验、OpenAPI、序列化、SSE、错误处理。

家庭规则在 Application / Domain。Agent 工具只是 Command 的另一扇门。

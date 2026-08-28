# 首期需求（Phase 0）

首期目标：在一台机器上跑起来一个**可登录、可维护家庭事实、可配餐、可对话 Agent** 的 Family OS。质量标准是架构约束被代码兑现，而不是功能清单堆满。

## 产品形态

单一家庭内部使用。默认一个家庭、一个 owner 账号。界面中文，PC 与手机都能用。

## 用户故事

1. 作为家庭管理员，我可以用引导账号登录，并看到当前家庭会话。
2. 作为成员，我可以创建、查看、修改、归档家庭人物，并查看人物修订。
3. 作为成员，我可以维护食材和菜谱（含份量、预计烹饪时间）。
4. 作为成员，我可以为某一餐创建配餐草稿（手动指定菜谱，或让系统按约束挑选），确认后成为正式用餐。
5. 作为用餐者，我可以标记用餐完成，并按人物提交评分。
6. 作为成员，我可以创建、更新、完成家庭任务。
7. 作为成员，我可以打开 Agent 对话：模型通过工具调用同一套 Command 来查/改家庭数据；敏感写入需要确认。
8. 作为部署者，我可以用 Docker Compose 在同域路径下同时启动 Web 与 API，API 独占 SQLite 数据卷。

## 功能范围

### 必须有

- Monorepo 骨架：`apps/web`、`apps/api`、`apps/worker`（占位）、`packages/api-client`
- Hono `/api/v1` + 生成 OpenAPI
- RFC 9457 错误
- Cookie 会话认证与 `RequestIdentity`
- SQLite WAL + Drizzle 迁移
- 人物 / 食材菜谱 / 配餐用餐 / 任务
- 幂等键与乐观锁
- Agent Run + SSE 事件 + 工具注册 + 确认流
- Agent 默认 DeepSeek；无 Key 时使用确定性 Stub Model，保证本地可测
- 模型供应商可更换（OpenAI / Ollama / OpenAI 兼容端点），客户端事件形状不变
- Next.js 页面覆盖登录、人物、菜谱、配餐、任务、Agent
- Compose：reverse-proxy / web / api / backup

### 首期刻意做薄的部分

- 权限模型只有 owner/member/viewer，界面不提供复杂成员邀请。
- 配餐“Agent 挑选”可以是规则引擎（时长、用餐人、未归档菜谱），不强制每次调用大模型。
- 文件上传只保留目录与权限校验骨架，不做成相册产品。
- 备份服务能在本地生成一致性副本；对象存储上传可配置，缺凭证时跳过。
- UI 以清晰可用为准，不追求设计系统完整度。

## 验收标准

1. `pnpm test` 覆盖：认证、人物 CRUD/归档/修订/乐观锁/幂等、菜谱、配餐确认、任务、Agent 工具与 HTTP 写入同一人物。
2. `pnpm openapi:export` 产出与路由一致的 `openapi/openapi.json`。
3. Web 不包含 `better-sqlite3` / `drizzle-orm` 依赖。
4. API 不依赖 `apps/web`。
5. 无 Key 时 Agent Stub 能通过工具创建人物，数据库中只有一条写入路径产生的记录。
6. Compose 配置中仅 `api`（及 backup）挂载数据卷。

## 非目标

见 [out-of-scope.md](./out-of-scope.md)。

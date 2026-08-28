# Family OS 文档

Family OS 是面向单一家庭的本地优先操作系统：用独立 Hono API 解释和改变家庭事实，用 Next.js 呈现这些事实，用 OpenAPI 作为所有客户端的唯一稳定边界。

## 怎么读

1. [架构总览](./architecture/overview.md) — 系统长什么样、为什么这样拆。
2. [核心原则](./architecture/principles.md) — 不可妥协的约束。
3. [职责边界](./architecture/boundaries.md) — Next.js / Hono / Agent / SQLite 各自做什么。
4. [首期需求](./requirements/phase-0.md) — 现在要实现什么。
5. [明确不做](./requirements/out-of-scope.md) — 现在坚决不做的事。
6. [计划目录](../plans/README.md) — 实现顺序与状态。

## 文档地图

### 架构

| 文档 | 内容 |
| --- | --- |
| [overview.md](./architecture/overview.md) | 总体架构、进程拓扑、目录定版 |
| [principles.md](./architecture/principles.md) | 契约、所有权、命令汇合等原则 |
| [boundaries.md](./architecture/boundaries.md) | Web / API / Worker / 反向代理边界 |
| [schemas-and-openapi.md](./architecture/schemas-and-openapi.md) | 四层 Schema 与 OpenAPI 契约 |
| [commands-and-agent.md](./architecture/commands-and-agent.md) | HTTP 与 Agent 共用 Command |
| [data-sqlite.md](./architecture/data-sqlite.md) | SQLite 所有权、备份、迁移条件 |
| [auth.md](./architecture/auth.md) | 身份、Cookie、未来多端 Token |
| [errors-and-writes.md](./architecture/errors-and-writes.md) | RFC 9457、幂等键、乐观锁 |
| [deployment.md](./architecture/deployment.md) | 同域部署与 Compose |

### 需求

| 文档 | 内容 |
| --- | --- |
| [phase-0.md](./requirements/phase-0.md) | 首期范围、用户故事、验收标准 |
| [out-of-scope.md](./requirements/out-of-scope.md) | 首期不做、后续触发条件 |

### 模块

| 文档 | 内容 |
| --- | --- |
| [identity.md](./modules/identity.md) | 家庭、账号、会话 |
| [people.md](./modules/people.md) | 人物与修订 |
| [recipes.md](./modules/recipes.md) | 食材与菜谱 |
| [meals.md](./modules/meals.md) | 配餐草稿、用餐、评分 |
| [tasks.md](./modules/tasks.md) | 家庭任务 |
| [agent.md](./modules/agent.md) | Agent Run、工具、确认 |

## 文档先行规则

- 先改文档和计划，再改代码。
- 对外契约以生成的 `openapi/openapi.json` 为准，不以 TypeScript 类型共享为准。
- 计划状态只在 [plans/README.md](../plans/README.md) 的主表更新；各计划文件与主表保持一致。

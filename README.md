# Family OS

面向单一家庭的本地优先操作系统。

> Next.js 负责呈现家庭数据，Hono 负责解释和改变家庭事实；OpenAPI 是两者以及未来所有客户端之间唯一稳定的边界。

## 先读文档

- [文档入口](./docs/README.md)
- [架构总览](./docs/architecture/overview.md)
- [首期需求](./docs/requirements/phase-0.md)
- [计划主表](./plans/README.md)

## 开发

```bash
cp .env.example .env
cp .env.local.example .env.local
# 在 .env.local 填入 DEEPSEEK_API_KEY
pnpm install
pnpm dev
```

- Web: http://127.0.0.1:3000
- API: http://127.0.0.1:3001
- OpenAPI: http://127.0.0.1:3001/api/v1/openapi.json
- 本地开发默认账号：`admin` / `changeme`（见 `.env.example`）；生产环境不会用该密码创建账号，并会在升级时检测和轮换旧默认密码
- Agent 密钥：`DEEPSEEK_API_KEY` 只从环境变量读取（优先级：进程环境 > `ENV_FILE` > `.env.local` > `.env`）

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 同时启动 Web 与 API |
| `pnpm test` | 跑 API 集成测试 |
| `pnpm openapi:export` | 从 Hono 导出 OpenAPI |
| `pnpm openapi:generate` | 生成 `packages/api-client` 类型 |

## 部署

```bash
cp .env.example .env
cp .env.local.example .env.local
# 在 .env 中替换 BOOTSTRAP_ADMIN_PASSWORD
docker compose up --build
```

入口：http://localhost:8080 。优先级与密钥注入见 [部署文档](./docs/architecture/deployment.md)。

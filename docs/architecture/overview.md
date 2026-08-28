# 架构总览

## 一句话

**Next.js 负责呈现家庭数据，Hono 负责解释和改变家庭事实；OpenAPI 是两者以及未来所有客户端之间唯一稳定的边界。**

## 系统图

```text
                     family.example.com
                              │
                       Caddy / Nginx
                              │
              ┌───────────────┴────────────────┐
              │                                │
          /*  │                         /api/* │
              ▼                                ▼
      Next.js Web                         Hono API
      apps/web                            apps/api
      :3000                               :3001
              │                                │
              │ OpenAPI Generated Client       │
              └───────────────────────────────►│
                                               │
                                  ┌────────────┴─────────────┐
                                  │ Application Commands     │
                                  │ Domain Services          │
                                  │ Agent Tool Registry      │
                                  └────────────┬─────────────┘
                                               │
                           ┌───────────────────┼─────────────────┐
                           ▼                   ▼                 ▼
                       SQLite              文件目录         DeepSeek API
                       /data/app.db        /data/files       ModelGateway
```

未来增加客户端时，全部走同一套 OpenAPI：

```text
Next.js Web ───┐
微信小程序 ────┤
iOS / Android ─┼──► 标准 OpenAPI ──► Hono API
桌面客户端 ────┤
家庭设备 ──────┘
```

## 独立到什么程度（首期定版）

| 维度 | 首期 |
| --- | --- |
| 独立 API 进程 | 是 |
| 独立 Next.js 进程 | 是 |
| 独立代码目录 | 是 |
| Monorepo | 是 |
| 独立 Git 仓库 | 否 |
| 独立服务器 | 否 |
| 微服务 | 否 |
| 多个 API 副本 | 否 |
| Next.js 直接访问数据库 | 否 |
| Hono 独占数据库访问 | 是 |

这是**模块化单体**，不是微服务。一台机器上跑：

```text
web
api
reverse-proxy
backup
```

出现长时间任务和定时任务后再增加 `worker`，且 Worker 必须与 SQLite 同机。

## 为什么不是 Next.js 全栈

Next.js 可以做 BFF，但 BFF 偏向服务某一个前端。本项目明确要多端、Agent 工具、SQLite 单所有者。因此：

- 核心业务 API 不能依赖 Next.js 页面生命周期。
- DeepSeek Key、表结构、工具执行、家庭权限只存在于 Hono。
- Web 只知道稳定 HTTP 资源，例如 `POST /api/v1/people`。

## 技术定版

| 层 | 选择 |
| --- | --- |
| 工程组织 | pnpm workspace Monorepo |
| Web | Next.js App Router（SSR / RSC 保留），PC + 手机响应式 |
| API | Hono + Node.js，不跑 Edge |
| 契约 | Zod Code First，OpenAPI Contract First |
| 客户端 | `openapi-typescript` + `openapi-fetch` |
| 数据库 | SQLite + WAL + Drizzle，仅 API（及未来同机 Worker）访问 |
| Agent | DeepSeekModelGateway + ToolRegistry，工具进入同一套 Command |
| 错误 | RFC 9457 Problem Details |
| 部署 | 同域路径转发，Docker Compose |

## 仓库目录定版

```text
family-os/
├── apps/
│   ├── web/                       # Next.js
│   ├── api/                       # Hono + Node.js
│   └── worker/                    # 首期占位，不启动
├── packages/
│   ├── api-client/                # 由 OpenAPI 生成，禁止手改 schema
│   ├── config/                    # 共享 TSConfig 等
│   └── testkit/                   # API 集成测试夹具
├── docs/                          # 架构与需求（本文档树）
├── plans/                         # 独立计划目录
├── openapi/
│   ├── openapi.json               # 对外正式契约
│   └── snapshots/
├── docker/
├── compose.yaml
└── package.json
```

禁止建立前后端都直接引用的 `packages/domain`。Web 只依赖 `packages/api-client`；API 不依赖 Web；Domain 只存在于 API 内部。

## 运行时边界

浏览器：

```text
/api/v1   （相对路径，经反向代理到 Hono）
```

Next.js Server Component：

```text
http://api:3001/api/v1   （容器内直连，绕过反向代理）
```

环境变量：

```env
NEXT_PUBLIC_API_BASE_URL=/api/v1
INTERNAL_API_BASE_URL=http://api:3001/api/v1
```

本地开发可用 Next.js rewrite 把 `/api/v1` 转到 `http://127.0.0.1:3001/api/v1`，这只是代理，不是第二套业务 API。

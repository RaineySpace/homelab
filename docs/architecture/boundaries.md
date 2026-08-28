# 职责边界

## Next.js（apps/web）

可以做：

- App Router、RSC、SSR、Streaming、Metadata
- 响应式 PC / 手机布局
- 服务端预取
- 客户端 TanStack Query
- 后续可选 PWA

不可以做：

- 直接访问 SQLite
- Server Action 直接执行业务写入
- 持有任何模型 API Key
- 维护另一套业务校验
- Route Handler 实现重复业务 API

若使用 Server Action，只能是薄封装：

```text
Server Action → Generated API Client → Hono API
```

首期多数页面由 Server Component 或 Client Component 直接调用生成客户端。

## Hono（apps/api）

独占：

- SQLite 连接与迁移
- 本地 `/data/files`
- ModelGateway / Provider Registry（默认 DeepSeek，可更换）
- Agent 系统提示词与工具执行
- 家庭权限与审计
- OpenAPI 生成

运行时固定为 **Hono + Node.js**。不针对 Edge Runtime 裁剪 SQLite 与本地文件。

## Worker（apps/worker）

首期只保留目录占位，不启动。出现以下能力后再启用，且必须与 SQLite 同机：

- 定时生成一周食谱
- 大文件解析 / 批量导入
- 营养重算、图片识别
- 定时提醒、长 AI 任务、导出、备份校验

## 反向代理

同域：

```text
https://family.example.com/          → Next.js
https://family.example.com/api/v1/*  → Hono
```

首期不使用 `web.` / `api.` 子域，以避免 CORS、Cookie、SSE 复杂度。

## 包依赖方向

```text
apps/web ──► packages/api-client ──► openapi/openapi.json
apps/api ──x── apps/web
apps/api 拥有全部 Domain
packages/api-client 不包含任何服务端能力
```

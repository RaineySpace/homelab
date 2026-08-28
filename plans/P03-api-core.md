# P03 API 内核

- 状态：已完成
- 分类：后端
- 依赖：P02

## 目标

Hono + Node.js 内核：请求 ID、RFC 9457、Zod/OpenAPI、SQLite WAL、Drizzle、幂等存储、健康检查。不含业务模块。

## 验收

- [x] `GET /api/v1/health` 返回 ok
- [x] 校验失败返回 `application/problem+json`
- [x] 可导出 `openapi/openapi.json`
- [x] SQLite 启用 WAL、busy_timeout、外键
- [x] 数据目录默认 `./data`

## 证据

- `pnpm --filter @family-os/api test`：`src/health-auth.test.ts`
- 运行中进程：`GET http://127.0.0.1:3001/api/v1/health` → 200 `{"status":"ok"}`
- `pnpm openapi:export` 写出 `openapi/openapi.json`

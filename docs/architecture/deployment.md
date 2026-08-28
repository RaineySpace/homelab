# 部署

## Compose 服务

```yaml
services:
  reverse-proxy:  # Caddy，统一对外入口
  web:            # Next.js，不挂载 SQLite
  api:            # Hono + Node.js，挂载 /data
  backup:         # 定期 VACUUM INTO，可选上传对象存储
```

P0 不启动 Worker。Agent 在 API 进程内完成：

```text
HTTP Request → SSE → ModelGateway（默认 DeepSeek）→ Tool Call → Command → Database
```

模型供应商由 `AGENT_MODEL_PROVIDER`（默认 `deepseek`）与 `PUT /api/v1/agent/model` 决定。密钥只进入 `api` 容器环境或家庭加密设置，不进入 Web 镜像。

## 同域转发

```text
/            → web:3000
/api/*       → api:3001
```

## 本地开发

```bash
pnpm install
pnpm dev
```

- API：`http://127.0.0.1:3001`
- Web：`http://127.0.0.1:3000`
- Web 将 `/api/v1/*` rewrite 到 API
- OpenAPI 文档：`http://127.0.0.1:3001/api/v1/openapi.json`
- 健康检查：`GET /api/v1/health`

## 环境变量

见根目录 `.env.example`。秘密不得写入镜像或文档示例以外的默认生产值。

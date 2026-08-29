# 部署

## Compose 服务

```yaml
services:
  reverse-proxy:  # Caddy，统一对外入口，http://localhost:8080
  web:            # Next.js standalone，不挂载 SQLite
  api:            # Hono + Node.js，挂载 /data
  backup:         # 定期 VACUUM INTO
```

P0 不启动 Worker。Agent 在 API 进程内完成：

```text
HTTP Request → SSE → ModelGateway（AI SDK DeepSeek；无 Key 时 Stub）→ Tool Call → Command → Database
```

密钥只进入 `api` 容器，不进入 Web 镜像，不入库。

## 同域转发

```text
/            → web:3000
/api/*       → api:3001
```

浏览器只访问 `http://localhost:8080`。Cookie 走同域，无需改 `SameSite`。

## Docker Compose

先准备环境文件（不要把密钥写进镜像或 `compose.yaml`）：

```bash
cp .env.example .env
cp .env.local.example .env.local
# 在 .env 中替换 BOOTSTRAP_ADMIN_PASSWORD
# 在 .env.local 填入 DEEPSEEK_API_KEY（可选；不填则 Agent 走 Stub）
docker compose up --build
```

- 入口：`http://localhost:8080`（默认只绑定 `127.0.0.1`）
- 健康检查：`GET http://localhost:8080/api/v1/health`
- 生产首次建库必须设置至少 12 位的 `BOOTSTRAP_ADMIN_PASSWORD`，且不能使用 `.env.example` 中的开发默认值

compose 的 `env_file` 仍设为 `required: false`，但生产环境首次建库或检测到旧默认密码时，缺少合格凭据会让 API 拒绝启动。

已有数据库若仍在使用 `changeme`，升级后需先在 `.env` 设置新的强密码；API 会在启动时轮换密码并撤销旧会话。已经改过密码的数据库不会被 `BOOTSTRAP_ADMIN_PASSWORD` 再次覆盖。

需要让家庭局域网中的其他设备访问时，可在 `.env` 设置 `COMPOSE_BIND_ADDRESS=0.0.0.0`；此时必须同时使用强凭据，并通过宿主机防火墙限制可信网段。公网访问应另行配置 HTTPS 和受控入口，不要直接暴露该端口。

不要把不存在的 `.env` bind mount 到 `/app/.env`：Docker 会在宿主机创建同名**目录**。需要挂文件时，先创建真实文件，或设置 `ENV_FILE` 指向容器内已有文件。

## 环境变量优先级

API 进程内合并，从高到低：

1. 已经存在的环境变量（compose `environment`、`docker -e`、shell export）
2. `ENV_FILE` 指向的文件（若设置）
3. `.env.local`
4. `.env`
5. 代码里的 Zod 默认值

空字符串视为「已设置」，不会被文件覆盖。因此 compose **不会**写 `DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}`：插值成空会挡住 `.env.local` 里的密钥。

compose 通过 `env_file` 把宿主机 `.env` / `.env.local` 注入为容器环境；再用 `environment` 覆盖必须压过本地文件的基础设施键：

| 键 | 容器值 | 原因 |
| --- | --- | --- |
| `DATA_DIR` | `/data` | 避免文件里的 `./data` 离开数据卷 |
| `API_HOST` / `API_PORT` | `0.0.0.0` / `3001` | 容器内监听 |
| `NODE_ENV` | `production` | |
| `PUBLIC_ORIGIN` | `http://localhost:8080` | 与 Caddy 入口一致；可用 `COMPOSE_PUBLIC_ORIGIN` 覆盖 |

`COMPOSE_BIND_ADDRESS` 只参与 Compose 端口映射，默认是 `127.0.0.1`，不会进入 API 进程。

`BOOTSTRAP_*`、`DEEPSEEK_*`、`COOKIE_SECURE`、`SESSION_TTL_DAYS` 交给 `.env` / `.env.local`；若用 `-e` 显式传入则优先。

Web 的 `NEXT_PUBLIC_API_BASE_URL` 与 `INTERNAL_API_BASE_URL` 在**镜像构建期**烘焙（`compose.yaml` 的 `web.build.args`），改运行时 `environment` 无效。

完整变量清单见根目录 `.env.example`。秘密不得写入镜像。

## 本地开发

```bash
cp .env.example .env
cp .env.local.example .env.local
pnpm install
pnpm dev
```

- API：`http://127.0.0.1:3001`
- Web：`http://127.0.0.1:3000`
- Web 将 `/api/v1/*` rewrite 到 API
- OpenAPI：`http://127.0.0.1:3001/api/v1/openapi.json`
- 健康检查：`GET /api/v1/health`
- 密钥：在 `.env.local` 填入 `DEEPSEEK_API_KEY`

# P16 Docker 部署订正与环境变量合并

- 状态：已完成
- 分类：部署
- 依赖：P12, P15

## 目标

修好 Compose / Dockerfile，使同域栈能生产式启动。保留 `.env` / `.env.local`，容器内合并配置：已设置的环境变量优先，缺省再读文件。

## 验收

- [x] API 镜像编译后以 `node dist/server.js` 启动
- [x] Web standalone 显式 `outputFileTracingRoot`；构建期 URL 走 `build.args`
- [x] compose `environment` 只覆盖基础设施键，不把空的 `DEEPSEEK_API_KEY` 注入容器
- [x] 进程内合并：环境变量 > `ENV_FILE` > `.env.local` > `.env`；跳过误挂成目录的 `.env`
- [x] `GET /api/v1/health` 作为 api healthcheck
- [x] 文档写清 `docker compose up --build` 与 `http://localhost:8080`

## 证据

- `pnpm --filter @family-os/api test`：6 files / 28 tests passed（含 `env.test.ts` 8 项：空字符串不覆盖、跳过目录、容器 `.env`、`ENV_FILE` 叠加）
- `pnpm --filter @family-os/api build`：`tsc -p tsconfig.build.json` 产出 `apps/api/dist/server.js`
- `sudo docker compose up --build -d`：`api` healthcheck 变为 healthy，随后 `web` 与 `reverse-proxy` 启动
- 容器内：`GET /api/v1/health` → `{"status":"ok"}`；Web `/` → 200；`POST /api/v1/auth/login` → 200 且 `Set-Cookie: family_os_session=...`
- 本验证机 Docker bridge 跨容器 TCP 超时，宿主机 `http://127.0.0.1:8080` 经 Caddy 得到 502；应用进程本身监听 `0.0.0.0`。正常 Docker 网络下应按文档走 `:8080`
- 实现路径：`apps/api/src/env.ts`、`compose.yaml`、`docker/Dockerfile`、`docker/api-entrypoint.sh`、`docs/architecture/deployment.md`

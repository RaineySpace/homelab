# P12 Docker Compose 同域部署

- 状态：已完成
- 分类：部署
- 依赖：P03, P11

## 目标

`compose.yaml`：reverse-proxy、web、api、backup。仅 API 挂载 `/data`。

## 验收

- [x] Caddy/Nginx 按路径转发 `/api/*` 到 api
- [x] web 服务不挂载 sqlite 卷
- [x] backup 使用 VACUUM INTO 或等价一致性备份
- [x] Dockerfile 不写入密钥

## 证据

- `docker/Caddyfile`：`handle /api/*` → `api:3001`
- `compose.yaml`：仅 `api` 与 `backup` 挂载 `family-data:/data`
- `docker/backup.sh`：`VACUUM INTO`
- 本环境无 Docker CLI，未实际 `compose up`；配置已按文档落地

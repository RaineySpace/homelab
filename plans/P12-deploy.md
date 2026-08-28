# P12 Docker Compose 同域部署

- 状态：正在执行
- 分类：部署
- 依赖：P03, P11

## 目标

`compose.yaml`：reverse-proxy、web、api、backup。仅 API 挂载 `/data`。

## 验收

- [ ] Caddy/Nginx 按路径转发 `/api/*` 到 api
- [ ] web 服务不挂载 sqlite 卷
- [ ] backup 使用 VACUUM INTO 或等价一致性备份
- [ ] Dockerfile 不写入密钥

## 证据

（完成后填写）

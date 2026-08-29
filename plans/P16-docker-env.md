# P16 Docker 部署订正与环境变量合并

- 状态：正在执行
- 分类：部署
- 依赖：P12, P15

## 目标

修好 Compose / Dockerfile，使同域栈能生产式启动。保留 `.env` / `.env.local`，容器内合并配置：已设置的环境变量优先，缺省再读文件。

## 验收

- [ ] API 镜像编译后以 `node dist/server.js` 启动
- [ ] Web standalone 显式 `outputFileTracingRoot`；构建期 URL 走 `build.args`
- [ ] compose `environment` 只覆盖基础设施键，不把空的 `DEEPSEEK_API_KEY` 注入容器
- [ ] 进程内合并：环境变量 > `.env.local` > `.env`；跳过误挂成目录的 `.env`
- [ ] `GET /api/v1/health` 作为 api healthcheck
- [ ] 文档写清 `docker compose up --build` 与 `http://localhost:8080`

## 证据

（实现后填写）

# P02 Monorepo 工程骨架

- 状态：已完成
- 分类：工程
- 依赖：P00

## 目标

建立 pnpm workspace：`apps/web`、`apps/api`、`apps/worker`（占位）、`packages/api-client`、`packages/config`、`packages/testkit`。

## 验收

- [x] 根目录 `package.json` + `pnpm-workspace.yaml` + lockfile
- [x] TypeScript 严格模式
- [x] Web 不依赖 API 源码；API 不依赖 Web
- [x] `apps/worker` 仅 README 占位
- [x] `.gitignore` 忽略 `node_modules`、`.next`、`data/`、`.env`

## 证据

- `pnpm-workspace.yaml` 包含 `apps/*` 与 `packages/*`
- `apps/web/package.json` 无 drizzle / better-sqlite3
- `apps/worker/README.md` 明确首期不启动

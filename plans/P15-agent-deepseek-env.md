# P15 Agent 首期仅 DeepSeek（AI SDK + 环境变量）

- 状态：已完成
- 分类：业务
- 依赖：P14

## 目标

首期只接 DeepSeek。通过 Vercel AI SDK 的 `@ai-sdk/deepseek` Provider 调用模型；API Key 只从环境变量引入（`.env` + `.env.local`，后者覆盖前者，进程环境优先）。无 Key 时回落 Stub，保证可测。

## 验收

- [x] `generateText` 使用 `createDeepSeek`，不再手写 Chat Completions
- [x] 密钥来自 `DEEPSEEK_API_KEY`（`.env` / `.env.local`），不经 Web、不入库
- [x] 首期不提供 OpenAI / Ollama / 家庭设置切换
- [x] 无 Key 时 Stub 仍走 Tool Registry → Command

## 证据

- `pnpm --filter @family-os/api test`：24 passed（含 `env.test.ts`、`gateway.test.ts` 的 AI SDK mock、`agent.test.ts` 无 Key Stub 建人与 `PUT /agent/model` 404）
- `pnpm openapi:export` / `pnpm openapi:generate`：`GET /agent/model` 只读，供应商枚举为 `deepseek | stub`
- 密钥加载：`applyEnvFiles` 保证进程环境 > `.env.local` > `.env`
- 实现路径：`apps/api/src/core/agent/deepseek.ts`（`createDeepSeek` + `generateText`）、`apps/api/src/env.ts`

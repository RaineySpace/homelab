# P14 Agent 模型可更换

- 状态：已完成
- 分类：业务
- 依赖：P09

## 目标

把 Agent 背后的模型从「有 DeepSeek Key 就用 DeepSeek，否则 Stub」升级为**可配置的 Provider Registry**：默认 DeepSeek，可换成 OpenAI、Ollama、任意 OpenAI 兼容端点（含自建 LiteLLM / OpenRouter / vLLM / LM Studio），客户端仍只看见统一 `AgentEvent`。

## 采用的社区实践

不引入独立 LiteLLM / Portkey 进程（单家庭模块化单体过重）。在 API 进程内落地这些开源方案的核心模式：

| 来源 | 落地 |
| --- | --- |
| Vercel AI SDK `createProviderRegistry` | `providerId:modelId` 目录，业务代码只拿 `ModelGateway` |
| `@ai-sdk/openai-compatible` / DeepSeek 官方 | 上游统一走 Chat Completions：`baseURL` + `apiKey` + `model` |
| LiteLLM `model_list` | 每个供应商是一份 preset：`api_base` / `api_key` / 默认模型 / 缺凭证回落 |
| Open WebUI / Continue / AnythingLLM | 家庭设置里更换供应商，密钥留在服务端 |
| DeepSeek V4（2026-07-24 起） | 默认模型 `deepseek-v4-flash`；工具循环关闭 thinking，对齐旧 `deepseek-chat` |

## 验收

- [x] 默认 `AGENT_MODEL_PROVIDER=deepseek`，默认模型 `deepseek-v4-flash`
- [x] 可通过环境变量或 `PUT /agent/model` 更换供应商，不改 OpenAPI 客户端事件形状
- [x] OpenAI / Ollama / openai-compatible / stub 共用同一 `ModelGateway`
- [x] 无 Key 时回落到 stub，仍走 Tool Registry → Command
- [x] 现有「Stub 创建人物」测试仍通过

## 证据

- `pnpm --filter @family-os/api test`：20 passed，含 `src/core/agent/gateway.test.ts` 与 `src/agent.test.ts` 的模型目录 / 更换 / DeepSeek 无 Key 回落
- `GET/PUT /api/v1/agent/model` 写入 `openapi/openapi.json`
- 实现：`apps/api/src/core/agent/*`；Web 助手页可更换供应商

# 模块：Agent

## 资源

```http
POST   /api/v1/agent/runs
GET    /api/v1/agent/runs/{runId}
GET    /api/v1/agent/runs/{runId}/events
POST   /api/v1/agent/actions/{actionId}/confirm
POST   /api/v1/agent/actions/{actionId}/reject
GET    /api/v1/agent/model
PUT    /api/v1/agent/model
```

`GET .../events` 使用 SSE。`POST /runs` 在 `Accept: text/event-stream` 时也可直接流式返回。

客户端只消费统一 `AgentEvent`，不理解 DeepSeek / OpenAI / Ollama 的原始字段。

## 创建 Run

```json
{
  "message": "帮我登记一个叫妈妈的人"
}
```

## 运行时

```text
HTTP Request
    ↓
SSE / JSON events
    ↓
ModelGateway（Provider Registry）
    ↓
Tool Call
    ↓
Command
    ↓
Database
```

默认供应商是 **DeepSeek**（`deepseek-v4-flash`）。更换供应商只改 Hono 侧配置，不改 OpenAPI。

## 模型目录

| id | 协议 | 默认模型 | 说明 |
| --- | --- | --- | --- |
| `deepseek` | OpenAI Chat Completions | `deepseek-v4-flash` | 产品默认 |
| `openai` | 同上 | `gpt-4o-mini` | 官方 OpenAI |
| `ollama` | 同上（`/v1`） | `qwen2.5` | 本机 Ollama |
| `openai-compatible` | 同上 | （必填） | OpenRouter / vLLM / LM Studio / 自建 LiteLLM |
| `stub` | 规则引擎 | `stub` | 无网、测试 |

选择优先级：家庭设置 → `AGENT_MODEL_PROVIDER` → 默认 `deepseek`。密钥优先级：家庭加密密钥 → 对应供应商环境变量。

所选供应商需要 Key 但未配置时，回落到 `stub`（可用 `AGENT_FALLBACK_PROVIDER=none` 改为直接失败）。

## 确认

敏感工具不直接执行，而是创建 `agent_actions`（status=pending），推送 `approval.required`。用户确认后执行原 Command。

## Stub Model

当实际生效的供应商是 `stub`：

- 能用非常短的规则识别“创建人物/列出人物/创建任务”等测试意图
- 或回声用户文本
- 保证集成测试不依赖外网

不得在 Stub 中绕过 Tool Registry 直接写库。

## 为何不内嵌 LiteLLM 进程

LiteLLM / Portkey 适合多应用、多团队预算与独立网关。Family OS 是单家庭模块化单体，在 API 内做 Registry + OpenAI 兼容适配器即可。若家里已经跑了 LiteLLM，把 `AGENT_MODEL_PROVIDER` 设为 `openai-compatible` 并指向其 `api_base`。

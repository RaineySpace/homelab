# 模块：Agent

## 资源

```http
POST   /api/v1/agent/runs
GET    /api/v1/agent/runs/{runId}
GET    /api/v1/agent/runs/{runId}/events
POST   /api/v1/agent/actions/{actionId}/confirm
POST   /api/v1/agent/actions/{actionId}/reject
GET    /api/v1/agent/model
```

`GET .../events` 使用 SSE。`POST /runs` 在 `Accept: text/event-stream` 时也可直接流式返回。

客户端只消费统一 `AgentEvent`，不理解 DeepSeek 的原始字段。

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
ModelGateway（AI SDK DeepSeek；无 Key 时 Stub）
    ↓
Tool Call
    ↓
Command
    ↓
Database
```

首期只接 **DeepSeek**（默认 `deepseek-v4-flash`），通过 Vercel AI SDK 的 `@ai-sdk/deepseek` 调用。密钥只从环境变量 `DEEPSEEK_API_KEY` 读取，不经 Web、不入库。

加载顺序：已有进程环境（Docker / shell）> `ENV_FILE` > `.env.local` > `.env`。容器约定还会读 `/app/.env`；根目录与 `apps/api` 都会扫描。跳过误挂成目录的文件。

未配置 Key 时回落到 `stub`，工具仍走同一套 Command。

## 模型状态

`GET /api/v1/agent/model` 只读：返回是否回落、当前模型名、是否已配置 Key（布尔，不含密钥本身）。首期没有 `PUT /agent/model`。

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | （空） | 必填才能走真实模型 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | 官方或兼容端点 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | 模型 id |
| `AGENT_MODEL_TIMEOUT_MS` | `60000` | 单次调用超时 |
| `AGENT_MODEL_RETRIES` | `1` | AI SDK 重试次数 |

## 确认

敏感工具不直接执行，而是创建 `agent_actions`（status=pending），推送 `approval.required`。用户确认后执行原 Command。

## Stub Model

当未配置 `DEEPSEEK_API_KEY`：

- 能用非常短的规则识别“创建人物/列出人物/创建任务”等测试意图
- 或回声用户文本
- 保证集成测试不依赖外网

不得在 Stub 中绕过 Tool Registry 直接写库。

## 为何不内嵌 LiteLLM 进程

LiteLLM / Portkey 适合多应用、多团队预算与独立网关。Family OS 是单家庭模块化单体，首期在 API 内用 AI SDK DeepSeek Provider 即可。多供应商切换放到后续。

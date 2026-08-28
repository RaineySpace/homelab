# 模块：Agent

## 资源

```http
POST   /api/v1/agent/runs
GET    /api/v1/agent/runs/{runId}
GET    /api/v1/agent/runs/{runId}/events
POST   /api/v1/agent/actions/{actionId}/confirm
POST   /api/v1/agent/actions/{actionId}/reject
```

`GET .../events` 使用 SSE。`POST /runs` 在 `Accept: text/event-stream` 时也可直接流式返回。

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
SSE
    ↓
ModelGateway（DeepSeek 或 Stub）
    ↓
Tool Call
    ↓
Command
    ↓
Database
```

## 确认

敏感工具不直接执行，而是创建 `agent_actions`（status=pending），推送 `approval.required`。用户确认后执行原 Command。

## Stub Model

当 `DEEPSEEK_API_KEY` 为空：

- 能用非常短的规则识别“创建人物/列出人物/创建任务”等测试意图
- 或回声用户文本
- 保证集成测试不依赖外网

不得在 Stub 中绕过 Tool Registry 直接写库。

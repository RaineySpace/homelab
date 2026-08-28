# P09 Agent 内核与工具注册

- 状态：已完成
- 分类：业务
- 依赖：P05, P07, P08

## 目标

ModelGateway、ToolRegistry、SSE AgentEvent、敏感动作确认。工具必须进入 Application Command。

## 验收

- [x] 无 API Key 时 Stub 仍走工具注册表
- [x] 用 Agent 创建人物与 HTTP 创建写入同一张表、同一 Command
- [x] 归档人物在确认前不生效
- [x] SSE 事件类型符合文档，不含 DeepSeek 原始字段

## 证据

- `src/agent.test.ts`：Stub 创建「妈妈」；归档需确认
- `apps/api/src/modules/agent.ts` 中 `people.create` 调用 `createPersonCommand`

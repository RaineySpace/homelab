# Command 与 Agent

## 最重要的约束

HTTP 与 Agent 最终必须调用同一个 Command。不能出现第二条写路径。

## HTTP 路径

```text
普通表单
   │
   ▼
POST /api/v1/people
   │
   ▼
CreatePersonCommand
   │
   ▼
PeopleApplicationService
   │
   ▼
Repository
```

## Agent 路径

```text
用户对话
   │
   ▼
ModelGateway Tool Call: people.create
（首期 DeepSeek / AI SDK；无 Key 时 Stub）
   │
   ▼
Agent Tool 参数 Zod 校验
   │
   ▼
CreatePersonCommand
   │
   ▼
PeopleApplicationService
   │
   ▼
Repository
```

汇合示例：

```ts
await createPersonCommand.execute({
  householdId: context.householdId,
  actorAccountId: context.accountId,
  source: 'agent',
  idempotencyKey: context.toolExecutionId,
  ...toolInput,
})
```

## 命令清单（首期）

| 命令 | 用途 |
| --- | --- |
| `identity.login` | 登录 |
| `identity.logout` | 登出 |
| `identity.getSession` | 当前身份 |
| `people.list` | 列出人物 |
| `people.get` | 人物详情 |
| `people.create` | 创建人物 |
| `people.update` | 更新人物 |
| `people.archive` | 归档人物 |
| `people.listRevisions` | 修订历史 |
| `ingredients.list` | 列出食材 |
| `ingredients.create` | 创建食材 |
| `recipes.list` | 列出菜谱 |
| `recipes.get` | 菜谱详情 |
| `recipes.create` | 创建菜谱 |
| `recipes.update` | 更新菜谱 |
| `recipes.archive` | 归档菜谱 |
| `meals.composeDraft` | 创建配餐草稿 |
| `meals.getDraft` | 读取草稿 |
| `meals.regenerateDraft` | 重新生成草稿 |
| `meals.confirmDraft` | 确认成正式用餐 |
| `meals.list` | 列出用餐 |
| `meals.get` | 用餐详情 |
| `meals.complete` | 标记已吃完 |
| `meals.submitRating` | 提交评分 |
| `tasks.list` | 列出任务 |
| `tasks.create` | 创建任务 |
| `tasks.update` | 更新任务 |
| `tasks.complete` | 完成任务 |
| `agent.startRun` | 开启一轮对话 |
| `agent.getRun` | 读取 Run |
| `agent.confirmAction` | 确认敏感动作 |
| `agent.rejectAction` | 拒绝敏感动作 |
| `agent.getModel` | 读取当前模型状态（只读） |

## Agent 事件（与模型无关）

```ts
type AgentEvent =
  | { type: 'text.delta'; delta: string }
  | { type: 'tool.started'; toolExecutionId: string; tool: string }
  | { type: 'tool.completed'; toolExecutionId: string; result: unknown }
  | { type: 'approval.required'; actionId: string; summary: string }
  | { type: 'run.completed'; runId: string }
  | { type: 'run.failed'; runId: string; error: ApiProblem }
```

客户端不理解任何供应商特有格式。SSE 只推上述事件。更换底层模型不得改变事件形状。

## 敏感写入

以下动作默认需要确认（Agent 路径）：

- `people.archive`
- `recipes.archive`
- `meals.confirmDraft`

确认后走原来的 Command，而不是另一套“已批准写入”。

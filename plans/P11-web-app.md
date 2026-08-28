# P11 Next.js Web 首期界面

- 状态：已完成
- 分类：前端
- 依赖：P10, P04–P09

## 目标

中文响应式界面：登录、总览、人物、菜谱、配餐、任务、Agent。不访问 SQLite，不持有模型密钥。

## 验收

- [x] 未登录访问业务页跳转登录
- [x] 可完成人物创建与列表
- [x] 可创建菜谱与配餐草稿并确认
- [x] 可创建任务
- [x] 可发送 Agent 消息并看到回复（Stub 即可）
- [x] `apps/web/package.json` 无 drizzle / better-sqlite3 / 模型 SDK

## 证据

- 浏览器：登录后进入 `/`，人物页出现「表哥」「奶奶」「测试成员」「妈妈」
- 菜谱页出现「土豆丝」；任务页可创建并完成
- Agent JSON：`POST /api/v1/agent/runs` 经 Web rewrite 调用 `people.create` 创建「叔叔」
- `apps/web/package.json` 不含 drizzle / better-sqlite3
- Next.js 16 需配置 `allowedDevOrigins: ['127.0.0.1', 'localhost']`，否则开发资源 403，表单无法水合

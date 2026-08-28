# P13 首期验收与回归

- 状态：已完成
- 分类：验收
- 依赖：P02–P12

## 目标

对照 `docs/requirements/phase-0.md` 逐条用当前工作区证据证明完成，而不是用意图代替验收。

## 验收

- [x] `pnpm test` 通过
- [x] OpenAPI 已导出
- [x] Web/API 进程边界检查通过
- [x] 浏览器或等效方式走通登录与人物创建
- [x] 主计划表状态与事实一致

## 证据

- `pnpm --filter @family-os/api test`：4 files / 10 tests passed
- `openapi/openapi.json` 由 `pnpm openapi:export` 生成；`packages/api-client/src/schema.d.ts` 自动生成
- Web 不依赖 API 源码；API 不依赖 Web
- 浏览器登录、人物/菜谱/任务创建；Agent 经同一 Command 创建人物
- 主表见 `plans/README.md`

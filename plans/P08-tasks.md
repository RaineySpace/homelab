# P08 任务模块

- 状态：已完成
- 分类：业务
- 依赖：P05

## 目标

家庭任务的创建、更新、完成。可关联人物。

## 验收

- [x] 列表可按 status 过滤
- [x] 完成任务写入 completedAt
- [x] 乐观锁

## 证据

- `src/family-flow.test.ts` 创建并完成任务，写入 completedAt
- `PATCH /tasks/{taskId}` 使用 version

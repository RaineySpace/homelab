# P05 人物模块

- 状态：已完成
- 分类：业务
- 依赖：P04

## 目标

人物 CRUD（删除=归档）、修订历史、乐观锁、幂等创建。HTTP 与后续 Agent 共用 Command。

## 验收

- [x] 文档中的 6 个 HTTP 端点可用
- [x] 部分出生日期非法时 422
- [x] 错误 version 返回 409
- [x] 相同 Idempotency-Key 不创建第二个人
- [x] 归档后默认列表不可见

## 证据

- `src/people.test.ts`

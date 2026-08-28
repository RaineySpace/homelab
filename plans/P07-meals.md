# P07 配餐与用餐模块

- 状态：已完成
- 分类：业务
- 依赖：P05, P06

## 目标

meal-drafts 的创建 / 再生 / 确认，meals 的查询 / 完成 / 评分。Agent 与手动共用 Command。

## 验收

- [x] manual 模式必须提供 recipeIds
- [x] agent 模式按 maxCookingMinutes 挑选未归档菜谱
- [x] confirm 生成 meal 并冻结草稿
- [x] 完成后才能评分
- [x] 重复 confirm 同一草稿幂等

## 证据

- `src/family-flow.test.ts`

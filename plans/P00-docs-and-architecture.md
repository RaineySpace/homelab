# P00 文档体系与架构定版

- 状态：已完成
- 分类：基础
- 依赖：无

## 目标

把空仓库变成“文档先行”的 Family OS：架构、边界、首期需求、模块说明齐备，后续计划以此为验收原文。

## 范围

- `docs/` 全部架构与需求文档
- 根 README 指向文档与计划
- 技术定版写入文档，不在代码里另立一套口头架构

## 验收

- [x] `docs/README.md` 可作为阅读入口
- [x] 架构文档覆盖：总览、原则、边界、Schema、Command/Agent、SQLite、认证、错误与写保护、部署
- [x] `docs/requirements/phase-0.md` 给出首期用户故事与验收
- [x] `docs/requirements/out-of-scope.md` 明确不做
- [x] 六个业务模块文档存在

## 证据

- 文档树：`docs/README.md`、`docs/architecture/*`、`docs/requirements/*`、`docs/modules/*`
- 根 README 指向文档入口与计划主表

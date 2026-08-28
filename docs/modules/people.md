# 模块：人物

## 资源

```http
GET    /api/v1/people
POST   /api/v1/people
GET    /api/v1/people/{personId}
PATCH  /api/v1/people/{personId}
DELETE /api/v1/people/{personId}
GET    /api/v1/people/{personId}/revisions
```

`DELETE` 为归档（`archivedAt`），不是物理删除。列表默认不返回已归档。

## 字段

- `name`：1–50 字符
- `birth`：部分日期 `{ year, month?, day? }`，允许只知道年，或年+月；日必须伴随月
- `sex`：`female` | `male` | `other` | `unknown` | null
- `version`：乐观锁

## 修订

每次成功更新写入 `person_revisions`，记录变更前快照、actor、source。

## Agent 工具

- `people.list`
- `people.get`
- `people.create`
- `people.update`
- `people.archive`（需确认）

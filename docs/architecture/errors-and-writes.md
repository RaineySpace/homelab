# 错误格式与写保护

## RFC 9457 Problem Details

```json
{
  "type": "https://family.example.com/problems/validation-error",
  "title": "请求参数校验失败",
  "status": 422,
  "code": "PERSON_BIRTH_DATE_INVALID",
  "detail": "2020 年 2 月不存在第 30 天",
  "instance": "/api/v1/people",
  "requestId": "req_123",
  "errors": [
    {
      "path": ["birth", "day"],
      "code": "invalid_date",
      "message": "出生日期不是有效的自然日"
    }
  ]
}
```

`Content-Type: application/problem+json`。

## 前端映射

| 状态 | 行为 |
| --- | --- |
| 401 | 打开登录 |
| 403 | 权限提示 |
| 404 | 数据不存在 |
| 409 | 版本冲突，提示刷新 |
| 422 | 映射到表单字段 |
| 429 | 操作过于频繁 |
| 500 | 展示 requestId |

## 幂等键

可能被 Agent 或网络重试的创建 / 确认操作支持：

```http
Idempotency-Key: tool_execution_123
```

相同键 + 相同请求指纹返回第一次结果。键冲突（同样的键、不同的体）返回 `409 IDEMPOTENCY_KEY_CONFLICT`。

首期覆盖：`people.create`、`recipes.create`、`ingredients.create`、`meals.composeDraft`、`meals.confirmDraft`、`meals.submitRating`、`tasks.create`、`agent.startRun`。

## 乐观锁

更新体携带当前 `version`。SQL 形态：

```sql
UPDATE people
SET name = ?, version = version + 1
WHERE id = ? AND version = 5 AND household_id = ?
```

更新数量为零且记录仍存在 → `409 ENTITY_VERSION_CONFLICT`。
记录已归档或不存在 → `404`。

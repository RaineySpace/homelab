# 模块：配餐与用餐

不把所有业务动作硬塞成 CRUD。

## 资源

```http
POST   /api/v1/meal-drafts
GET    /api/v1/meal-drafts/{mealDraftId}
POST   /api/v1/meal-drafts/{mealDraftId}/regenerate
POST   /api/v1/meal-drafts/{mealDraftId}/confirm

GET    /api/v1/meals
GET    /api/v1/meals/{mealId}
POST   /api/v1/meals/{mealId}/complete
PUT    /api/v1/meals/{mealId}/ratings/{personId}
```

## 创建草稿

```json
{
  "mealType": "dinner",
  "dinerPersonIds": ["person_1", "person_2"],
  "mode": "normal",
  "maxCookingMinutes": 40,
  "selectionMode": "agent"
}
```

- `selectionMode=manual` 时必须提供 `recipeIds`
- `selectionMode=agent` 时由规则引擎按烹饪时长从未归档菜谱中挑选（可 0 道，返回可解释原因）
- `mealType`：`breakfast` | `lunch` | `dinner` | `snack`

## 状态

```text
draft → confirmed meal → completed
```

确认后草稿冻结。完成用餐后才能评分。评分 1–5，按人物一份。

# 模块：食材与菜谱

## 资源

```http
GET    /api/v1/ingredients
POST   /api/v1/ingredients

GET    /api/v1/recipes
POST   /api/v1/recipes
GET    /api/v1/recipes/{recipeId}
PATCH  /api/v1/recipes/{recipeId}
POST   /api/v1/recipes/{recipeId}/archive
```

## 食材

- `name` 家庭内唯一（未归档范围）
- 可选 `unit`（g / ml / piece 等自由短文本）

## 菜谱

- `title`
- `cookingMinutes`
- `servings`
- `steps`：字符串数组
- `ingredients`：`{ ingredientId, quantity, note? }[]`
- `archivedAt`

配餐只使用未归档菜谱。

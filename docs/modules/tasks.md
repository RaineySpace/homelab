# 模块：任务

## 资源

```http
GET    /api/v1/tasks
POST   /api/v1/tasks
GET    /api/v1/tasks/{taskId}
PATCH  /api/v1/tasks/{taskId}
POST   /api/v1/tasks/{taskId}/complete
```

## 字段

- `title`
- `notes`
- `assigneePersonId` 可选
- `dueAt` 可选
- `status`：`open` | `completed`
- `version`

完成任务将 `status` 设为 `completed`，并记录 `completedAt`。

# 模块：身份

## 资源

```http
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/session
GET    /api/v1/health
```

## 规则

- 登录成功设置会话 Cookie，返回账号与家庭摘要。
- 登出撤销服务端会话。
- `GET /session` 未登录返回 401 Problem Details。
- `GET /health` 不需要认证，返回 `{ status: "ok" }`。
- 首期一个家庭。账号属于该家庭。

## 数据

- `households`
- `accounts`（username 唯一，password_hash）
- `sessions`（token_hash、expires_at）

# 模块：身份

## 资源

```http
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/session
POST   /api/v1/auth/password/change
GET    /api/v1/accounts
POST   /api/v1/accounts
PATCH  /api/v1/accounts/{accountId}
POST   /api/v1/accounts/{accountId}/password/reset
POST   /api/v1/accounts/{accountId}/disable
POST   /api/v1/accounts/{accountId}/enable
GET    /api/v1/health
```

## 规则

- 登录成功设置会话 Cookie，返回账号、家庭、角色、权限和关联人物摘要。
- 登出撤销服务端会话。
- 停用账号、重置密码或改变普通账号角色会撤销目标全部会话。
- 自助修改密码验证当前密码，只保留发起修改的当前会话。
- `GET /session` 未登录返回 401 Problem Details。
- `GET /health` 不需要认证，返回 `{ status: "ok" }`。
- 首期一个家庭。账号属于该家庭。
- owner 是唯一管理员；账号管理接口只授予 owner。member 完整读写家庭业务，viewer 只读。
- 新建账号只能是 member/viewer，必须选择未绑定人物或在同一事务内新建人物。
- 不提供账号删除、owner 转移或第二个 owner。
- 人物归档前必须不存在绑定的启用账号。

## 数据

- `households`
- `accounts`（username 唯一、password_hash、唯一非空 person_id、disabled_at）
- `sessions`（token_hash、expires_at）
- `people`（账号一对一关联的家庭人物）
- `schema_migrations`（每个 SQL migration 只执行一次）
- `audit_events`（只记录 actor、target 与非敏感变更摘要）

审计命令包括 `accounts.create/update/role_change/password_reset/disable/enable`、`auth.password_change` 和 owner 恢复事件；密码与哈希不进入审计。

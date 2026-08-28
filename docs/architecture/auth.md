# 认证与身份

## RequestIdentity

无论 Cookie 还是未来 Bearer，中间件都产出：

```ts
interface RequestIdentity {
  accountId: string
  householdId: string
  sessionId: string
  permissions: string[]
  authMethod: 'cookie' | 'bearer'
}
```

## 首期 Web

- HttpOnly + Secure + SameSite=Lax Cookie
- 本地 HTTP 开发允许 `Secure` 关闭
- 会话存在 SQLite `sessions` 表
- 密码使用 scrypt 哈希，不明文存储

## 未来多端（首期只留接口形状，不实现签发）

- 短期 Access Token
- 长期设备 Session
- 刷新与设备撤销

Bearer 解析逻辑可以存在，但首期不提供登录换 Token 的正式产品路径，避免两套会话并行失控。

## 权限

首期角色：

| 角色 | 权限 |
| --- | --- |
| owner | 全部 |
| member | 读写业务，不能删除家庭 |
| viewer | 只读 |

业务代码：

```ts
if (!identity.permissions.includes('people:create')) { ... }
```

不要：

```ts
if (hasCookie) { ... }
```

## 引导账号

首次启动若库中无账号，使用环境变量创建 owner：

```env
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=changeme
BOOTSTRAP_HOUSEHOLD_NAME=默认家庭
```

生产必须改掉默认密码。

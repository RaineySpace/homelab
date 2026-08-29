# 认证与身份

## RequestIdentity

无论 Cookie 还是未来 Bearer，中间件都产出：

```ts
interface RequestIdentity {
  accountId: string
  householdId: string
  sessionId: string
  username: string
  role: 'owner' | 'member' | 'viewer'
  person: { id: string; name: string }
  permissions: string[]
  authMethod: 'cookie' | 'bearer'
}
```

## 首期 Web

- HttpOnly + Secure + SameSite=Lax Cookie
- 本地 HTTP 开发允许 `Secure` 关闭
- 会话存在 SQLite `sessions` 表
- 密码使用 scrypt 哈希，不明文存储
- 每个启用账号必须关联一个未归档家庭人物；一个人物最多绑定一个账号
- 解析身份时同时检查账号启用、人物未归档和会话未过期，停用账号后旧 Cookie 立即失效

## 未来多端（首期只留接口形状，不实现签发）

- 短期 Access Token
- 长期设备 Session
- 刷新与设备撤销

Bearer 解析逻辑可以存在，但首期不提供登录换 Token 的正式产品路径，避免两套会话并行失控。

## 权限

首期角色：

| 角色 | 权限 |
| --- | --- |
| owner | 全部业务读写和账号管理；全库唯一 |
| member | 全部家庭业务读写，不可管理账号 |
| viewer | 家庭业务只读，不可管理账号 |

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
BOOTSTRAP_ADMIN_PERSON_NAME=管理员
BOOTSTRAP_HOUSEHOLD_NAME=默认家庭
```

首次建库会在同一事务中创建家庭、owner 人物和 owner 账号。SQLite 部分唯一索引禁止第二个 `role = 'owner'`，启动阶段也要求数据库恰好存在一个 owner。

`admin` / `changeme` 只用于本地开发。`NODE_ENV=production` 首次建库时，API 要求 `BOOTSTRAP_ADMIN_PASSWORD` 至少 12 位且不能使用默认值；不满足就拒绝启动。

升级已有数据库时，如果 owner 尚未关联人物，启动阶段会查找唯一的同名未绑定人物，找不到则创建，出现多个候选则拒绝启动。未关联有效人物的遗留 member/viewer 会被停用并撤销会话，由 owner 完成人物关联后再启用。账号 ID、角色和业务引用不变。

如果账号仍使用 `changeme`，生产启动阶段会要求提供合格的 `BOOTSTRAP_ADMIN_PASSWORD`，自动轮换密码并撤销该账号的全部旧会话。已经使用非默认密码的账号不会被环境变量覆盖。

当前会话使用随机令牌，数据库只保存 SHA-256 哈希，不依赖全局 `SESSION_SECRET`。

## 账号与密码管理

- owner 可创建 member/viewer，修改其用户名、人物关联和角色，重置密码及停用/启用账号。
- owner 可修改自己的用户名和人物关联，但不能创建第二个 owner、改变自身角色、经管理接口重置自身密码或停用自身。
- 所有用户都可用当前密码修改自己的密码。成功后保留当前会话并撤销其他会话。
- 创建、重置和自助修改的新密码均限制为 12–200 个字符。管理操作不提供账号删除或 owner 转移。
- 普通账号角色变化、密码重置和停用都会撤销目标全部会话；重新启用不会恢复旧会话。
- 绑定启用账号的人物不能归档。普通账号需先停用；owner 需先改绑到另一个未绑定、未归档人物。

owner 无法登录且不能通过自助入口恢复时，在 API 所在机器运行：

```bash
pnpm --filter @family-os/api owner:reset-password
```

命令只接受交互式 TTY 隐藏输入，不接受命令行明文密码；成功后撤销 owner 全部会话并写入恢复审计。

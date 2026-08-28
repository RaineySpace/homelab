# Schema 分层与 OpenAPI

## 推荐关系

```text
服务端开发源
    Zod Schema
        │
        ├──► Hono 请求校验
        ├──► Hono 响应类型
        ├──► Agent Tool Schema
        └──► 生成 OpenAPI
                         │
                         ▼
               openapi.json
                         │
              ┌──────────┴─────────┐
              ▼                    ▼
       Web API Client       未来多端 Client
```

含义：

- 开发时 Zod 是源。
- 对外契约是生成的 OpenAPI。
- Web 使用 `openapi-typescript` + `openapi-fetch`。
- 正式调用不使用 Hono RPC。

## 四层

### 1. Transport Schema

HTTP 入参 / 出参。使用 `z.strictObject`，拒绝未知字段。

```ts
const CreatePersonRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(50),
  birth: PartialBirthDateSchema.nullable(),
  sex: SexSchema.nullable(),
})
```

响应单独定义，例如 `PersonResponseSchema`，包含 `id`、`version`、`createdAt`、`updatedAt`。不要把 persistence row 直接当响应。

### 2. Application Command

补上只有服务端才知道的上下文：

```ts
type CreatePersonCommand = {
  householdId: string
  actorAccountId: string
  source: 'manual' | 'agent' | 'import'
  idempotencyKey: string
  name: string
  birth: PartialBirthDate | null
  sex: Sex | null
}
```

### 3. Domain Entity

表达真实业务状态，使用品牌类型或只读接口，例如 `Person`、`PersonName`、`PartialBirthDate`。

### 4. Persistence Model

数据库列可以拆得更细，例如出生日期：

```text
people.birth_precision
people.birth_year
people.birth_month
people.birth_day
```

映射发生在 Repository，不发生在 Route Handler。

## Agent 工具 Schema

工具参数可以复用 Transport 的业务字段，但必须再包一层工具元数据校验。工具执行时由运行时注入 `householdId` 等上下文，再调用同一个 Command。

## 生成产物

| 产物 | 是否手改 |
| --- | --- |
| `apps/api` 中的 Zod | 手写 |
| `openapi/openapi.json` | 由 API 导出，可提交，不手改字段 |
| `packages/api-client/src/schema.d.ts` | 生成，禁止手改 |
| `packages/api-client` 的薄封装 | 手写 |

导出命令：`pnpm openapi:export`。生成客户端：`pnpm openapi:generate`。

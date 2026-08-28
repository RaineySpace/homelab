# 数据与 SQLite

## 布局

```text
/data/
├── app.db
├── files/
├── backups/
└── exports/
```

本地开发默认 `./data/`，容器内挂载 `/data`。

## 配置

- WAL 模式
- `busy_timeout`（首期 5000ms）
- 外键开启
- 事务必须短
- 单 API 实例

## 备份

使用 SQLite Online Backup API 或 `VACUUM INTO` 创建一致性副本。禁止直接复制活动 `app.db` / `-wal` / `-shm`。

## 迁移触发

| 情况 | 数据库 |
| --- | --- |
| 一台机器、一个家庭、单 API 实例 | SQLite（当前） |
| 多个 API 实例、仍希望 SQLite 兼容 | libSQL / Turso |
| 多家庭 SaaS、高并发写、多服务 | PostgreSQL |
| 数据库必须跨机器共享 | PostgreSQL |

## ORM

Drizzle 只出现在 `apps/api` 的 infrastructure。Application 依赖 Repository 接口，不依赖 Drizzle 类型泄露到 HTTP 层。

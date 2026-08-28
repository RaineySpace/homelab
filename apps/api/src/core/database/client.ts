import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'
import type { Env } from '../../env.js'

export type Db = BetterSQLite3Database<typeof schema>

const here = dirname(fileURLToPath(import.meta.url))

export function sqlitePath(env: Env): string {
  if (env.DATA_DIR === ':memory:') return ':memory:'
  return join(env.DATA_DIR, 'app.db')
}

export function createSqlite(env: Env): Database.Database {
  const path = sqlitePath(env)
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
    mkdirSync(join(env.DATA_DIR, 'files'), { recursive: true })
    mkdirSync(join(env.DATA_DIR, 'backups'), { recursive: true })
    mkdirSync(join(env.DATA_DIR, 'exports'), { recursive: true })
  }
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  return sqlite
}

export function createDb(sqlite: Database.Database): Db {
  return drizzle(sqlite, { schema })
}

export function applyMigrations(sqlite: Database.Database): void {
  const sqlPath = join(here, '../../../drizzle/0001_init.sql')
  const sql = readFileSync(sqlPath, 'utf8')
  sqlite.exec(sql)
}

export function backupDatabase(sqlite: Database.Database, destination: string): void {
  sqlite.exec(`VACUUM INTO '${destination.replaceAll("'", "''")}'`)
}

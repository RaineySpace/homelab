import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseDotenv } from 'dotenv'
import { z } from 'zod'

const workspaceRootFromSource = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const EnvSchema = z.object({
  API_PORT: z.coerce.number().int().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  DATA_DIR: z.string().default('./data'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SESSION_SECRET: z.string().min(8).default('dev-session-secret-change-me'),
  BOOTSTRAP_ADMIN_USERNAME: z.string().min(1).default('admin'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1).default('changeme'),
  BOOTSTRAP_HOUSEHOLD_NAME: z.string().min(1).default('默认家庭'),
  AGENT_MODEL_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  AGENT_MODEL_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  DEEPSEEK_API_KEY: z.string().optional().default(''),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().default('deepseek-v4-flash'),
  PUBLIC_ORIGIN: z.string().default('http://127.0.0.1:3000'),
  NODE_ENV: z.string().optional().default('development'),
})

export type Env = z.infer<typeof EnvSchema>

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const path of paths) {
    if (seen.has(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

/**
 * 合并来自文件的环境变量：后出现的覆盖先出现的。
 * 已经存在于 processEnv 的键（Docker / shell 导出）一律不覆盖。
 */
export function applyEnvFiles(processEnv: NodeJS.ProcessEnv, fileContentsInOrder: Array<Record<string, string>>): void {
  const preexisting = new Set(Object.keys(processEnv).filter((key) => processEnv[key] !== undefined))
  const merged: Record<string, string> = {}
  for (const contents of fileContentsInOrder) {
    Object.assign(merged, contents)
  }
  for (const [key, value] of Object.entries(merged)) {
    if (!preexisting.has(key)) processEnv[key] = value
  }
}

export function dotenvFilePaths(options?: { cwd?: string; workspaceRoot?: string }): string[] {
  const cwd = options?.cwd ?? process.cwd()
  const workspaceRoot = options?.workspaceRoot ?? workspaceRootFromSource
  const apiDir = resolve(workspaceRoot, 'apps/api')
  return uniquePaths([
    resolve(workspaceRoot, '.env'),
    resolve(apiDir, '.env'),
    resolve(cwd, '.env'),
    resolve(workspaceRoot, '.env.local'),
    resolve(apiDir, '.env.local'),
    resolve(cwd, '.env.local'),
  ])
}

/** 先 `.env` 再 `.env.local`；local 覆盖同名文件值；已有进程环境优先。 */
export function loadDotenvFiles(options?: { cwd?: string; workspaceRoot?: string; env?: NodeJS.ProcessEnv }): void {
  const env = options?.env ?? process.env
  const contents: Array<Record<string, string>> = []
  for (const path of dotenvFilePaths(options)) {
    if (!existsSync(path)) continue
    contents.push(parseDotenv(readFileSync(path)))
  }
  applyEnvFiles(env, contents)
}

let dotenvLoaded = false

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env && !dotenvLoaded) {
    loadDotenvFiles()
    dotenvLoaded = true
  }
  return EnvSchema.parse(source)
}

export const testEnv = (): Env =>
  loadEnv({
    DATA_DIR: ':memory:',
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-session-secret-change-me',
    BOOTSTRAP_ADMIN_USERNAME: 'admin',
    BOOTSTRAP_ADMIN_PASSWORD: 'changeme',
    BOOTSTRAP_HOUSEHOLD_NAME: '默认家庭',
    PUBLIC_ORIGIN: 'http://family.example.com',
    NODE_ENV: 'test',
  })

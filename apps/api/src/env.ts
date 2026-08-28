import { z } from 'zod'
import { MODEL_PROVIDER_IDS } from './core/agent/catalog.js'

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
  AGENT_MODEL_PROVIDER: z.enum(MODEL_PROVIDER_IDS).default('deepseek'),
  AGENT_MODEL: z.string().optional().default(''),
  AGENT_BASE_URL: z.string().optional().default(''),
  AGENT_API_KEY: z.string().optional().default(''),
  AGENT_FALLBACK_PROVIDER: z.enum(['stub', 'none']).default('stub'),
  AGENT_MODEL_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  AGENT_MODEL_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  DEEPSEEK_API_KEY: z.string().optional().default(''),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().default('deepseek-v4-flash'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OLLAMA_API_KEY: z.string().optional().default(''),
  OLLAMA_BASE_URL: z.string().default('http://127.0.0.1:11434/v1'),
  OLLAMA_MODEL: z.string().default('qwen2.5'),
  PUBLIC_ORIGIN: z.string().default('http://127.0.0.1:3000'),
  NODE_ENV: z.string().optional().default('development'),
})

export type Env = z.infer<typeof EnvSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
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
    AGENT_MODEL_PROVIDER: 'stub',
  })

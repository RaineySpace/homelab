import { z } from 'zod'

const EnvSchema = z.object({
  API_PORT: z.coerce.number().int().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  DATA_DIR: z.string().default('./data'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BOOTSTRAP_ADMIN_USERNAME: z.string().min(1).default('admin'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1).default('changeme'),
  BOOTSTRAP_HOUSEHOLD_NAME: z.string().min(1).default('默认家庭'),
  DEEPSEEK_API_KEY: z.string().optional().default(''),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
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
    BOOTSTRAP_ADMIN_USERNAME: 'admin',
    BOOTSTRAP_ADMIN_PASSWORD: 'changeme',
    BOOTSTRAP_HOUSEHOLD_NAME: '默认家庭',
    PUBLIC_ORIGIN: 'http://family.example.com',
    NODE_ENV: 'test',
  })

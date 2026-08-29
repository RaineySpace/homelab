import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyEnvFiles, isReadableEnvFile, loadDotenvFiles, loadEnv } from './env.js'

describe('env files', () => {
  it('lets .env.local override .env but never overrides existing process env', () => {
    const env: NodeJS.ProcessEnv = { EXISTING: 'from-shell', KEEP: 'shell' }
    applyEnvFiles(env, [
      { EXISTING: 'from-env', LOCAL: 'base', KEEP: 'env' },
      { LOCAL: 'local', EXTRA: 'yes' },
    ])
    expect(env.EXISTING).toBe('from-shell')
    expect(env.KEEP).toBe('shell')
    expect(env.LOCAL).toBe('local')
    expect(env.EXTRA).toBe('yes')
  })

  it('loads .env then .env.local from workspace root', () => {
    const dir = mkdtempSync(join(tmpdir(), 'family-os-env-'))
    writeFileSync(join(dir, '.env'), 'A=1\nB=2\nDEEPSEEK_API_KEY=from-env\n')
    writeFileSync(join(dir, '.env.local'), 'B=3\nDEEPSEEK_API_KEY=from-local\n')
    const env: NodeJS.ProcessEnv = { A: 'shell' }
    loadDotenvFiles({ cwd: dir, workspaceRoot: dir, env })
    expect(env.A).toBe('shell')
    expect(env.B).toBe('3')
    expect(env.DEEPSEEK_API_KEY).toBe('from-local')
  })

  it('treats empty process env as set and does not fill from file', () => {
    const env: NodeJS.ProcessEnv = { DEEPSEEK_API_KEY: '' }
    applyEnvFiles(env, [{ DEEPSEEK_API_KEY: 'from-file' }])
    expect(env.DEEPSEEK_API_KEY).toBe('')
  })

  it('skips a directory that Docker created instead of an env file', () => {
    const root = mkdtempSync(join(tmpdir(), 'family-os-env-dir-'))
    const containerDir = join(root, 'app')
    mkdirSync(join(containerDir), { recursive: true })
    mkdirSync(join(containerDir, '.env'))
    writeFileSync(join(root, '.env'), 'DEEPSEEK_API_KEY=from-real-file\n')
    const env: NodeJS.ProcessEnv = {}
    loadDotenvFiles({ cwd: root, workspaceRoot: root, containerDir, env })
    expect(isReadableEnvFile(join(containerDir, '.env'))).toBe(false)
    expect(env.DEEPSEEK_API_KEY).toBe('from-real-file')
  })

  it('reads container .env when no workspace file exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'family-os-env-ctr-'))
    const containerDir = join(root, 'app')
    mkdirSync(containerDir, { recursive: true })
    writeFileSync(join(containerDir, '.env'), 'BOOTSTRAP_ADMIN_PASSWORD=from-container\n')
    const env: NodeJS.ProcessEnv = { DATA_DIR: '/data' }
    loadDotenvFiles({ cwd: join(root, 'cwd'), workspaceRoot: root, containerDir, env })
    expect(env.DATA_DIR).toBe('/data')
    expect(env.BOOTSTRAP_ADMIN_PASSWORD).toBe('from-container')
  })

  it('lets ENV_FILE overlay other env files', () => {
    const root = mkdtempSync(join(tmpdir(), 'family-os-env-file-'))
    writeFileSync(join(root, '.env'), 'PUBLIC_ORIGIN=from-root\n')
    writeFileSync(join(root, 'custom.env'), 'PUBLIC_ORIGIN=from-custom\n')
    const env: NodeJS.ProcessEnv = {}
    loadDotenvFiles({ cwd: root, workspaceRoot: root, envFile: join(root, 'custom.env'), env })
    expect(env.PUBLIC_ORIGIN).toBe('from-custom')
  })

  it('lets cwd .env.local win over workspace .env', () => {
    const root = mkdtempSync(join(tmpdir(), 'family-os-root-'))
    const cwd = join(root, 'apps', 'api')
    mkdirSync(cwd, { recursive: true })
    writeFileSync(join(root, '.env'), 'DEEPSEEK_MODEL=from-root-env\n')
    writeFileSync(join(cwd, '.env.local'), 'DEEPSEEK_MODEL=from-cwd-local\n')
    const env: NodeJS.ProcessEnv = {}
    loadDotenvFiles({ cwd, workspaceRoot: root, env })
    expect(env.DEEPSEEK_MODEL).toBe('from-cwd-local')
  })

  it('parses DeepSeek env defaults without other providers', () => {
    const env = loadEnv({
      DATA_DIR: ':memory:',
      NODE_ENV: 'test',
    })
    expect(env.DEEPSEEK_MODEL).toBe('deepseek-v4-flash')
    expect(env.DEEPSEEK_BASE_URL).toBe('https://api.deepseek.com')
    expect(env.DEEPSEEK_API_KEY).toBe('')
    expect(env.BOOTSTRAP_ADMIN_PERSON_NAME).toBe('管理员')
    expect(env).not.toHaveProperty('AGENT_MODEL_PROVIDER')
    expect(env).not.toHaveProperty('OPENAI_API_KEY')
  })
})

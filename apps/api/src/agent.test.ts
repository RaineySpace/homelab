import { describe, expect, it } from 'vitest'
import { people } from './core/database/schema.js'
import { createTestApp, jsonHeaders, login } from './testing.js'

describe('agent tools share commands', () => {
  it('creates a person through the stub model tool path', async () => {
    const { app, db } = await createTestApp()
    const { cookie } = await login(app)

    const run = await app.request('/api/v1/agent/runs', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ message: '帮我登记一个叫妈妈的人' }),
    })
    expect(run.status).toBe(201)
    const runBody = await run.json()
    expect(['completed', 'failed']).toContain(runBody.status)
    expect(runBody.status).toBe('completed')

    const list = await app.request('/api/v1/people', { headers: { Cookie: cookie } })
    const peopleJson = await list.json()
    expect(peopleJson.some((item: { name: string }) => item.name === '妈妈')).toBe(true)
    const rows = db.select().from(people).all()
    expect(rows).toHaveLength(1)
  })

  it('requires confirmation before archiving a person', async () => {
    const { app } = await createTestApp()
    const { cookie } = await login(app)
    const created = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ name: '孩子', birth: null, sex: null }),
    })
    const person = await created.json()

    const run = await app.request('/api/v1/agent/runs', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ message: `归档人物 ${person.id}` }),
    })
    expect(run.status).toBe(201)

    const still = await app.request(`/api/v1/people/${person.id}`, { headers: { Cookie: cookie } })
    expect((await still.json()).archivedAt).toBeNull()
  })
})

describe('agent model providers', () => {
  it('exposes the default DeepSeek catalog and falls back to stub without a key', async () => {
    const { app } = await createTestApp({ AGENT_MODEL_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: '' })
    const { cookie } = await login(app)
    const response = await app.request('/api/v1/agent/model', { headers: { Cookie: cookie } })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      requestedProvider: string
      activeProvider: string
      usingFallback: boolean
      canConfigure: boolean
      providers: Array<{ id: string; defaultModel: string }>
    }
    expect(body.requestedProvider).toBe('deepseek')
    expect(body.activeProvider).toBe('stub')
    expect(body.usingFallback).toBe(true)
    expect(body.canConfigure).toBe(true)
    expect(body.providers.map((item: { id: string }) => item.id)).toEqual([
      'deepseek',
      'openai',
      'ollama',
      'openai-compatible',
      'stub',
    ])
    expect(body.providers[0]?.defaultModel).toBe('deepseek-v4-flash')
  })

  it('lets the owner switch the household provider', async () => {
    const { app } = await createTestApp()
    const { cookie } = await login(app)
    const updated = await app.request('/api/v1/agent/model', {
      method: 'PUT',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ provider: 'ollama', model: 'qwen2.5', baseUrl: 'http://127.0.0.1:11434/v1' }),
    })
    expect(updated.status).toBe(200)
    const body = (await updated.json()) as {
      requestedProvider: string
      activeProvider: string
      source: string
      model: string
    }
    expect(body.requestedProvider).toBe('ollama')
    expect(body.activeProvider).toBe('ollama')
    expect(body.source).toBe('household')
    expect(body.model).toBe('qwen2.5')

    const again = await app.request('/api/v1/agent/model', { headers: { Cookie: cookie } })
    expect(((await again.json()) as { requestedProvider: string }).requestedProvider).toBe('ollama')
  })

  it('still uses stub tools after switching the configured provider to stub', async () => {
    const { app, db } = await createTestApp()
    const { cookie } = await login(app)
    await app.request('/api/v1/agent/model', {
      method: 'PUT',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ provider: 'stub' }),
    })
    const run = await app.request('/api/v1/agent/runs', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ message: '帮我登记一个叫爸爸的人' }),
    })
    expect(run.status).toBe(201)
    const rows = db.select().from(people).all()
    expect(rows.some((row) => row.name === '爸爸')).toBe(true)
  })

  it('falls back to stub tools when default DeepSeek has no key', async () => {
    const { app, db } = await createTestApp({ AGENT_MODEL_PROVIDER: 'deepseek' })
    const { cookie } = await login(app)
    const run = await app.request('/api/v1/agent/runs', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ message: '帮我登记一个叫奶奶的人' }),
    })
    expect(run.status).toBe(201)
    expect(((await run.json()) as { status: string }).status).toBe('completed')
    expect(db.select().from(people).all().some((row) => row.name === '奶奶')).toBe(true)
  })
})

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
    const runBody = (await run.json()) as any
    expect(['completed', 'failed']).toContain(runBody.status)
    expect(runBody.status).toBe('completed')

    const list = await app.request('/api/v1/people', { headers: { Cookie: cookie } })
    const peopleJson = (await list.json()) as any[]
    expect(peopleJson.some((item: { name: string }) => item.name === '妈妈')).toBe(true)
    const rows = db.select().from(people).all()
    expect(rows.filter((row) => row.name === '妈妈')).toHaveLength(1)
  })

  it('requires confirmation before archiving a person', async () => {
    const { app } = await createTestApp()
    const { cookie } = await login(app)
    const created = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ name: '孩子', birth: null, sex: null }),
    })
    const person = (await created.json()) as any

    const run = await app.request('/api/v1/agent/runs', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ message: `归档人物 ${person.id}` }),
    })
    expect(run.status).toBe(201)

    const still = await app.request(`/api/v1/people/${person.id}`, { headers: { Cookie: cookie } })
    expect(((await still.json()) as any).archivedAt).toBeNull()
  })
})

describe('agent DeepSeek env', () => {
  it('exposes DeepSeek status and falls back to stub without a key', async () => {
    const { app } = await createTestApp({ DEEPSEEK_API_KEY: '' })
    const { cookie } = await login(app)
    const response = await app.request('/api/v1/agent/model', { headers: { Cookie: cookie } })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      requestedProvider: string
      activeProvider: string
      usingFallback: boolean
      fallbackReason: string | null
      source: string
      hasApiKey: boolean
      providers: Array<{ id: string; defaultModel: string }>
    }
    expect(body.requestedProvider).toBe('deepseek')
    expect(body.activeProvider).toBe('stub')
    expect(body.usingFallback).toBe(true)
    expect(body.fallbackReason).toBe('missing_api_key')
    expect(body.source).toBe('env')
    expect(body.hasApiKey).toBe(false)
    expect(body.providers.map((item) => item.id)).toEqual(['deepseek'])
    expect(body.providers[0]?.defaultModel).toBe('deepseek-v4-flash')
  })

  it('does not allow switching the model over HTTP', async () => {
    const { app } = await createTestApp()
    const { cookie } = await login(app)
    const updated = await app.request('/api/v1/agent/model', {
      method: 'PUT',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ provider: 'ollama' }),
    })
    expect(updated.status).toBe(404)
  })

  it('falls back to stub tools when DeepSeek has no key', async () => {
    const { app, db } = await createTestApp()
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

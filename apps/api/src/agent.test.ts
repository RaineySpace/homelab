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

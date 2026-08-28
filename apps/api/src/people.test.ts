import { describe, expect, it } from 'vitest'
import { createTestApp, jsonHeaders, login } from './testing.js'

describe('people commands', () => {
  it('creates, lists, updates with optimistic lock, archives, and records revisions', async () => {
    const { app } = await createTestApp()
    const { cookie } = await login(app)

    const created = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(cookie, { 'Idempotency-Key': 'person-mom' }),
      body: JSON.stringify({ name: '妈妈', birth: { year: 1988, month: 5 }, sex: 'female' }),
    })
    expect(created.status).toBe(201)
    const person = await created.json()
    expect(person.name).toBe('妈妈')
    expect(person.version).toBe(1)

    const replay = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(cookie, { 'Idempotency-Key': 'person-mom' }),
      body: JSON.stringify({ name: '妈妈', birth: { year: 1988, month: 5 }, sex: 'female' }),
    })
    expect(replay.status).toBe(201)
    expect((await replay.json()).id).toBe(person.id)

    const conflictKey = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(cookie, { 'Idempotency-Key': 'person-mom' }),
      body: JSON.stringify({ name: '另一个', birth: null, sex: null }),
    })
    expect(conflictKey.status).toBe(409)

    const invalid = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ name: '孩子', birth: { year: 2020, month: 2, day: 30 }, sex: null }),
    })
    expect(invalid.status).toBe(422)

    const stale = await app.request(`/api/v1/people/${person.id}`, {
      method: 'PATCH',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ version: 99, name: '母亲' }),
    })
    expect(stale.status).toBe(409)
    expect((await stale.json()).code).toBe('ENTITY_VERSION_CONFLICT')

    const updated = await app.request(`/api/v1/people/${person.id}`, {
      method: 'PATCH',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ version: 1, name: '母亲' }),
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).version).toBe(2)

    const revisions = await app.request(`/api/v1/people/${person.id}/revisions`, {
      headers: { Cookie: cookie },
    })
    expect(revisions.status).toBe(200)
    const history = await revisions.json()
    expect(history[0].snapshot.name).toBe('妈妈')

    const archived = await app.request(`/api/v1/people/${person.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(archived.status).toBe(200)
    const list = await app.request('/api/v1/people', { headers: { Cookie: cookie } })
    expect(await list.json()).toEqual([])
  })
})

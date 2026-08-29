import { describe, expect, it } from 'vitest'
import { createTestApp, jsonHeaders, login } from './testing.js'

describe('health and auth', () => {
  it('returns health without login', async () => {
    const { app } = await createTestApp()
    const response = await app.request('/api/v1/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('rejects protected routes without a session', async () => {
    const { app } = await createTestApp()
    const response = await app.request('/api/v1/people')
    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).toContain('application/problem+json')
    const body = (await response.json()) as any
    expect(body.code).toBe('UNAUTHORIZED')
    expect(body.requestId).toBeTruthy()
  })

  it('logs in with the bootstrap owner and reads session', async () => {
    const { app } = await createTestApp()
    const { response, cookie } = await login(app)
    expect(response.status).toBe(200)
    expect(cookie.startsWith('family_os_session=')).toBe(true)
    const session = await app.request('/api/v1/auth/session', { headers: { Cookie: cookie } })
    expect(session.status).toBe(200)
    const body = (await session.json()) as any
    expect(body.username).toBe('admin')
    expect(body.role).toBe('owner')
    expect(body.person.name).toBe('管理员')
    expect(body.permissions).toContain('people:create')
  })

  it('rejects wrong password with 401', async () => {
    const { app } = await createTestApp()
    const { response } = await login(app, 'admin', 'nope')
    expect(response.status).toBe(401)
  })

  it('logout invalidates the session', async () => {
    const { app } = await createTestApp()
    const { cookie } = await login(app)
    const logout = await app.request('/api/v1/auth/logout', { method: 'POST', headers: { Cookie: cookie } })
    expect(logout.status).toBe(204)
    const session = await app.request('/api/v1/auth/session', { headers: { Cookie: cookie } })
    expect(session.status).toBe(401)
  })

  it('returns 422 problem details for invalid json bodies', async () => {
    const { app } = await createTestApp()
    const { cookie } = await login(app)
    const response = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ name: '' }),
    })
    expect(response.status).toBe(422)
    const body = (await response.json()) as any
    expect(body.code).toBe('VALIDATION_ERROR')
  })
})

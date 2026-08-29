import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { auditEvents, people } from './core/database/schema.js'
import { resetOwnerPassword } from './modules/accounts.js'
import { createTestApp, jsonHeaders, login } from './testing.js'

async function createAccount(
  app: Awaited<ReturnType<typeof createTestApp>>['app'],
  cookie: string,
  input: Record<string, unknown>,
) {
  return app.request('/api/v1/accounts', {
    method: 'POST',
    headers: jsonHeaders(cookie),
    body: JSON.stringify(input),
  })
}

describe('account management', () => {
  it('lets only owner manage accounts and applies member/viewer permissions immediately', async () => {
    const { app, db } = await createTestApp()
    const { cookie: ownerCookie } = await login(app)

    const ownerSessionResponse = await app.request('/api/v1/auth/session', { headers: { Cookie: ownerCookie } })
    const ownerSession = (await ownerSessionResponse.json()) as any
    expect(ownerSession.person.name).toBe('管理员')

    const createdResponse = await createAccount(app, ownerCookie, {
      username: 'mom',
      password: 'member-password-123',
      role: 'member',
      person: { type: 'new', name: '妈妈', birth: null, sex: 'female' },
    })
    expect(createdResponse.status).toBe(201)
    const created = (await createdResponse.json()) as any
    expect(created.role).toBe('member')
    expect(created.person.name).toBe('妈妈')
    expect(created).not.toHaveProperty('passwordHash')

    const { cookie: memberCookie } = await login(app, 'mom', 'member-password-123')
    const memberWrite = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(memberCookie),
      body: JSON.stringify({ name: '孩子', birth: null, sex: null }),
    })
    expect(memberWrite.status).toBe(201)
    expect((await app.request('/api/v1/accounts', { headers: { Cookie: memberCookie } })).status).toBe(403)
    const forbiddenAccountRequests = [
      app.request('/api/v1/accounts', {
        method: 'POST',
        headers: jsonHeaders(memberCookie),
        body: JSON.stringify({
          username: 'forbidden',
          password: 'forbidden-password',
          role: 'viewer',
          person: { type: 'new', name: '无权限', birth: null, sex: null },
        }),
      }),
      app.request(`/api/v1/accounts/${created.id}`, {
        method: 'PATCH',
        headers: jsonHeaders(memberCookie),
        body: JSON.stringify({ role: 'viewer' }),
      }),
      app.request(`/api/v1/accounts/${created.id}/password/reset`, {
        method: 'POST',
        headers: jsonHeaders(memberCookie),
        body: JSON.stringify({ newPassword: 'forbidden-password' }),
      }),
      app.request(`/api/v1/accounts/${created.id}/disable`, { method: 'POST', headers: { Cookie: memberCookie } }),
      app.request(`/api/v1/accounts/${created.id}/enable`, { method: 'POST', headers: { Cookie: memberCookie } }),
    ]
    expect((await Promise.all(forbiddenAccountRequests)).map((response) => response.status)).toEqual([
      403, 403, 403, 403, 403,
    ])

    const replacementPersonResponse = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(ownerCookie),
      body: JSON.stringify({ name: '母亲', birth: null, sex: 'female' }),
    })
    const replacementPerson = (await replacementPersonResponse.json()) as any
    const roleChange = await app.request(`/api/v1/accounts/${created.id}`, {
      method: 'PATCH',
      headers: jsonHeaders(ownerCookie),
      body: JSON.stringify({ username: 'mom-renamed', personId: replacementPerson.id, role: 'viewer' }),
    })
    expect(roleChange.status).toBe(200)
    expect(((await roleChange.json()) as any).role).toBe('viewer')
    expect((await app.request('/api/v1/people', { headers: { Cookie: memberCookie } })).status).toBe(401)

    expect((await login(app, 'mom', 'member-password-123')).response.status).toBe(401)
    const { cookie: viewerCookie } = await login(app, 'mom-renamed', 'member-password-123')
    expect((await app.request('/api/v1/people', { headers: { Cookie: viewerCookie } })).status).toBe(200)
    const viewerWrite = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(viewerCookie),
      body: JSON.stringify({ name: '无权限写入', birth: null, sex: null }),
    })
    expect(viewerWrite.status).toBe(403)

    const reset = await app.request(`/api/v1/accounts/${created.id}/password/reset`, {
      method: 'POST',
      headers: jsonHeaders(ownerCookie),
      body: JSON.stringify({ newPassword: 'reset-password-456' }),
    })
    expect(reset.status).toBe(204)
    expect((await app.request('/api/v1/auth/session', { headers: { Cookie: viewerCookie } })).status).toBe(401)
    expect((await login(app, 'mom-renamed', 'member-password-123')).response.status).toBe(401)
    const { response: resetLogin, cookie: resetCookie } = await login(app, 'mom-renamed', 'reset-password-456')
    expect(resetLogin.status).toBe(200)

    const disabled = await app.request(`/api/v1/accounts/${created.id}/disable`, {
      method: 'POST',
      headers: { Cookie: ownerCookie },
    })
    expect(disabled.status).toBe(200)
    expect(((await disabled.json()) as any).disabledAt).toBeTruthy()
    expect((await app.request('/api/v1/auth/session', { headers: { Cookie: resetCookie } })).status).toBe(401)
    expect((await login(app, 'mom-renamed', 'reset-password-456')).response.status).toBe(401)

    const enabled = await app.request(`/api/v1/accounts/${created.id}/enable`, {
      method: 'POST',
      headers: { Cookie: ownerCookie },
    })
    expect(enabled.status).toBe(200)
    expect(((await enabled.json()) as any).disabledAt).toBeNull()
    expect((await login(app, 'mom-renamed', 'reset-password-456')).response.status).toBe(200)
    const commands = db.select({ command: auditEvents.command }).from(auditEvents).all().map((row) => row.command)
    expect(commands).toEqual(expect.arrayContaining([
      'accounts.create',
      'accounts.update',
      'accounts.role_change',
      'accounts.password_reset',
      'accounts.disable',
      'accounts.enable',
    ]))
  })

  it('enforces person binding, owner protection, and archive/enable rules', async () => {
    const { app, db } = await createTestApp()
    const { cookie } = await login(app)
    const personResponse = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ name: '爸爸', birth: null, sex: 'male' }),
    })
    const person = (await personResponse.json()) as any

    const accountResponse = await createAccount(app, cookie, {
      username: 'dad',
      password: 'member-password-123',
      role: 'member',
      person: { type: 'existing', personId: person.id },
    })
    expect(accountResponse.status).toBe(201)
    const account = (await accountResponse.json()) as any

    const duplicatePerson = await createAccount(app, cookie, {
      username: 'dad2',
      password: 'member-password-123',
      role: 'viewer',
      person: { type: 'existing', personId: person.id },
    })
    expect(duplicatePerson.status).toBe(409)
    expect(((await duplicatePerson.json()) as any).code).toBe('ACCOUNT_PERSON_CONFLICT')

    const peopleBeforeDuplicateUsername = db.select().from(people).all().length
    const duplicateUsername = await createAccount(app, cookie, {
      username: 'dad',
      password: 'member-password-123',
      role: 'viewer',
      person: { type: 'new', name: '不会残留', birth: null, sex: null },
    })
    expect(duplicateUsername.status).toBe(409)
    expect(db.select().from(people).all()).toHaveLength(peopleBeforeDuplicateUsername)

    const archiveActive = await app.request(`/api/v1/people/${person.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(archiveActive.status).toBe(409)
    expect(((await archiveActive.json()) as any).code).toBe('PERSON_HAS_ACTIVE_ACCOUNT')

    const owner = ((await (await app.request('/api/v1/accounts', { headers: { Cookie: cookie } })).json()) as any[])
      .find((item) => item.role === 'owner')
    expect((await app.request(`/api/v1/accounts/${owner.id}/disable`, { method: 'POST', headers: { Cookie: cookie } })).status).toBe(409)
    const ownerRoleChange = await app.request(`/api/v1/accounts/${owner.id}`, {
      method: 'PATCH',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ role: 'member' }),
    })
    expect(ownerRoleChange.status).toBe(409)
    expect(
      (await app.request(`/api/v1/accounts/${owner.id}/password/reset`, {
        method: 'POST',
        headers: jsonHeaders(cookie),
        body: JSON.stringify({ newPassword: 'owner-reset-blocked' }),
      })).status,
    ).toBe(409)

    const newOwnerPersonResponse = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ name: '新管理员人物', birth: null, sex: null }),
    })
    const newOwnerPerson = (await newOwnerPersonResponse.json()) as any
    const ownerUpdated = await app.request(`/api/v1/accounts/${owner.id}`, {
      method: 'PATCH',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ username: 'owner-renamed', personId: newOwnerPerson.id }),
    })
    expect(ownerUpdated.status).toBe(200)
    expect(((await ownerUpdated.json()) as any).username).toBe('owner-renamed')
    expect(
      (await app.request(`/api/v1/people/${owner.person.id}`, { method: 'DELETE', headers: { Cookie: cookie } })).status,
    ).toBe(200)

    await app.request(`/api/v1/accounts/${account.id}/disable`, { method: 'POST', headers: { Cookie: cookie } })
    expect(
      (await app.request(`/api/v1/people/${person.id}`, { method: 'DELETE', headers: { Cookie: cookie } })).status,
    ).toBe(200)
    const enableArchived = await app.request(`/api/v1/accounts/${account.id}/enable`, {
      method: 'POST',
      headers: { Cookie: cookie },
    })
    expect(enableArchived.status).toBe(409)
    expect(((await enableArchived.json()) as any).code).toBe('ACCOUNT_PERSON_ARCHIVED')

    const createWithArchived = await createAccount(app, cookie, {
      username: 'archived-person',
      password: 'member-password-123',
      role: 'viewer',
      person: { type: 'existing', personId: person.id },
    })
    expect(createWithArchived.status).toBe(409)
    expect(((await createWithArchived.json()) as any).code).toBe('ACCOUNT_PERSON_ARCHIVED')
  })

  it('changes the current password while keeping only the current session', async () => {
    const { app } = await createTestApp()
    const { cookie: ownerCookie } = await login(app)
    await createAccount(app, ownerCookie, {
      username: 'child',
      password: 'member-password-123',
      role: 'member',
      person: { type: 'new', name: '孩子', birth: null, sex: null },
    })
    const { cookie: currentCookie } = await login(app, 'child', 'member-password-123')
    const { cookie: otherCookie } = await login(app, 'child', 'member-password-123')

    const wrongCurrent = await app.request('/api/v1/auth/password/change', {
      method: 'POST',
      headers: jsonHeaders(currentCookie),
      body: JSON.stringify({ currentPassword: 'wrong-password', newPassword: 'changed-password-789' }),
    })
    expect(wrongCurrent.status).toBe(401)
    expect((await app.request('/api/v1/auth/session', { headers: { Cookie: otherCookie } })).status).toBe(200)

    const changed = await app.request('/api/v1/auth/password/change', {
      method: 'POST',
      headers: jsonHeaders(currentCookie),
      body: JSON.stringify({ currentPassword: 'member-password-123', newPassword: 'changed-password-789' }),
    })
    expect(changed.status).toBe(204)
    expect((await app.request('/api/v1/auth/session', { headers: { Cookie: currentCookie } })).status).toBe(200)
    expect((await app.request('/api/v1/auth/session', { headers: { Cookie: otherCookie } })).status).toBe(401)
    expect((await login(app, 'child', 'member-password-123')).response.status).toBe(401)
    expect((await login(app, 'child', 'changed-password-789')).response.status).toBe(200)
  })

  it('recovers the unique owner password and audits the operation', async () => {
    const { app, db } = await createTestApp()
    const { cookie } = await login(app)
    resetOwnerPassword(db, 'recovered-owner-password')

    expect((await app.request('/api/v1/auth/session', { headers: { Cookie: cookie } })).status).toBe(401)
    expect((await login(app, 'admin', 'changeme')).response.status).toBe(401)
    expect((await login(app, 'admin', 'recovered-owner-password')).response.status).toBe(200)
    expect(
      db.select().from(auditEvents).where(eq(auditEvents.command, 'auth.owner_password_recovered')).all(),
    ).toHaveLength(1)
  })
})

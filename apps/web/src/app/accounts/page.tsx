'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { api, problemMessage } from '@/lib/api'

type Role = 'owner' | 'member' | 'viewer'
type Person = { id: string; name: string; archivedAt: string | null }
type Account = {
  id: string
  username: string
  role: Role
  person: { id: string; name: string } | null
  disabledAt: string | null
  createdAt: string
  updatedAt: string
}

const roleLabels: Record<Role, string> = {
  owner: 'owner（管理员）',
  member: 'member（可读写）',
  viewer: 'viewer（只读）',
}

function AccountCard({
  account,
  people,
  linkedPersonIds,
  onChanged,
}: {
  account: Account
  people: Person[]
  linkedPersonIds: Set<string>
  onChanged: () => Promise<void>
}) {
  const [username, setUsername] = useState(account.username)
  const [personId, setPersonId] = useState(account.person?.id ?? '')
  const [role, setRole] = useState<'member' | 'viewer'>(account.role === 'viewer' ? 'viewer' : 'member')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const isOwner = account.role === 'owner'
  const selectablePeople = people.filter(
    (person) => person.id === account.person?.id || !linkedPersonIds.has(person.id),
  )

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await action()
      await onChanged()
      setError('')
      setMessage(success)
      return true
    } catch (err) {
      setMessage('')
      setError(problemMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body: { username: string; personId: string; role?: 'member' | 'viewer' } = {
      username,
      personId,
    }
    if (!isOwner) body.role = role
    return run(
      () => api(`/accounts/${account.id}`, { method: 'PATCH', body: JSON.stringify(body) }),
      '账号资料已更新。',
    )
  }

  function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    return run(
      () => api(`/accounts/${account.id}/password/reset`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      }),
      '密码已重置，目标账号的旧会话已退出。',
    ).then((changed) => {
      if (changed) setNewPassword('')
    })
  }

  return (
    <article className="panel account-card">
      <div className="page-header">
        <div>
          <h2>{account.person?.name ?? '未关联人物'}</h2>
          <p className="muted account-meta">
            {roleLabels[account.role]} · {account.disabledAt ? '已停用' : '已启用'}
          </p>
        </div>
        <span className={`badge ${account.disabledAt ? 'disabled' : 'enabled'}`}>
          {account.disabledAt ? '停用' : '启用'}
        </span>
      </div>

      <form className="form-grid" onSubmit={save}>
        <label>
          用户名
          <input value={username} onChange={(event) => setUsername(event.target.value)} required maxLength={80} />
        </label>
        <label>
          关联人物
          <select value={personId} onChange={(event) => setPersonId(event.target.value)} required>
            <option value="" disabled>选择人物</option>
            {selectablePeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        {!isOwner ? (
          <label>
            角色
            <select value={role} onChange={(event) => setRole(event.target.value as 'member' | 'viewer')}>
              <option value="member">member（可读写）</option>
              <option value="viewer">viewer（只读）</option>
            </select>
          </label>
        ) : (
          <p className="muted">owner 角色不可变更。</p>
        )}
        <div>
          <button className="btn" type="submit" disabled={busy}>保存资料</button>
        </div>
      </form>

      {!isOwner ? (
        <>
          <form className="row account-action" onSubmit={resetPassword}>
            <input
              aria-label={`重置 ${account.username} 的密码`}
              type="password"
              placeholder="新密码（至少 12 个字符）"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={12}
              maxLength={200}
              required
            />
            <button className="btn secondary" type="submit" disabled={busy}>重置密码</button>
          </form>
          <div className="account-action">
            <button
              className={`btn ${account.disabledAt ? 'secondary' : 'danger'}`}
              type="button"
              disabled={busy}
              onClick={() => run(
                () => api(`/accounts/${account.id}/${account.disabledAt ? 'enable' : 'disable'}`, { method: 'POST' }),
                account.disabledAt ? '账号已启用，旧会话不会恢复。' : '账号已停用，全部会话已退出。',
              )}
            >
              {account.disabledAt ? '启用账号' : '停用账号'}
            </button>
          </div>
        </>
      ) : (
        <p className="muted account-action">owner 不能在此重置密码或停用，请到“设置”修改自己的密码。</p>
      )}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}
    </article>
  )
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [personMode, setPersonMode] = useState<'existing' | 'new'>('existing')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function refresh() {
    const [accountRows, personRows] = await Promise.all([
      api<Account[]>('/accounts'),
      api<Person[]>('/people'),
    ])
    setAccounts(accountRows)
    setPeople(personRows)
  }

  useEffect(() => {
    refresh().catch((err) => setError(problemMessage(err)))
  }, [])

  const linkedPersonIds = useMemo(
    () => new Set(accounts.flatMap((account) => account.person ? [account.person.id] : [])),
    [accounts],
  )
  const availablePeople = people.filter((person) => !linkedPersonIds.has(person.id))

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const birthYear = String(data.get('birthYear') ?? '').trim()
    const birthMonth = String(data.get('birthMonth') ?? '').trim()
    const birthDay = String(data.get('birthDay') ?? '').trim()
    const birth = birthYear
      ? {
          year: Number(birthYear),
          ...(birthMonth ? { month: Number(birthMonth) } : {}),
          ...(birthDay ? { day: Number(birthDay) } : {}),
        }
      : null
    const person = personMode === 'existing'
      ? { type: 'existing' as const, personId: String(data.get('personId') ?? '') }
      : {
          type: 'new' as const,
          name: String(data.get('personName') ?? ''),
          sex: data.get('sex') ? String(data.get('sex')) : null,
          birth,
        }
    setSubmitting(true)
    try {
      await api('/accounts', {
        method: 'POST',
        body: JSON.stringify({
          username: String(data.get('username') ?? ''),
          password: String(data.get('password') ?? ''),
          role: String(data.get('role') ?? ''),
          person,
        }),
      })
      form.reset()
      setPersonMode('existing')
      await refresh()
      setError('')
      setMessage('普通账号已创建。')
    } catch (err) {
      setMessage('')
      setError(problemMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>账号管理</h1>
          <p className="muted">owner 管理家庭账号；member 可读写，viewer 只读。</p>
        </div>
      </div>

      <form className="panel form-grid" onSubmit={createAccount}>
        <h2>新增普通账号</h2>
        <div className="form-columns">
          <label>
            用户名
            <input name="username" required maxLength={80} autoComplete="off" />
          </label>
          <label>
            初始密码
            <input name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password" />
          </label>
          <label>
            角色
            <select name="role" defaultValue="member">
              <option value="member">member（可读写）</option>
              <option value="viewer">viewer（只读）</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>关联家庭人物</legend>
          <div className="row mode-switch">
            <label className="inline-label">
              <input type="radio" name="personMode" checked={personMode === 'existing'} onChange={() => setPersonMode('existing')} />
              选择已有人物
            </label>
            <label className="inline-label">
              <input type="radio" name="personMode" checked={personMode === 'new'} onChange={() => setPersonMode('new')} />
              同时新建人物
            </label>
          </div>
          {personMode === 'existing' ? (
            <label>
              未绑定人物
              <select name="personId" required defaultValue="">
                <option value="" disabled>选择人物</option>
                {availablePeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
          ) : (
            <div className="form-columns">
              <label>
                姓名
                <input name="personName" required maxLength={50} />
              </label>
              <label>
                性别（可选）
                <select name="sex" defaultValue="">
                  <option value="">未填写</option>
                  <option value="female">女</option>
                  <option value="male">男</option>
                  <option value="other">其他</option>
                  <option value="unknown">未知</option>
                </select>
              </label>
              <label>
                出生年份（可选）
                <input name="birthYear" type="number" min={1900} max={2100} />
              </label>
              <label>
                月（可选）
                <input name="birthMonth" type="number" min={1} max={12} />
              </label>
              <label>
                日（可选）
                <input name="birthDay" type="number" min={1} max={31} />
              </label>
            </div>
          )}
        </fieldset>
        {availablePeople.length === 0 && personMode === 'existing' ? (
          <p className="muted">当前没有未绑定人物，可选择“同时新建人物”。</p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}
        <div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? '创建中…' : '创建账号'}
          </button>
        </div>
      </form>

      <section className="account-list">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            people={people}
            linkedPersonIds={linkedPersonIds}
            onChanged={refresh}
          />
        ))}
      </section>
    </AppShell>
  )
}

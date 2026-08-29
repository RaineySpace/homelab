'use client'

import { FormEvent, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { api, problemMessage } from '@/lib/api'

export default function SettingsPage() {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get('currentPassword') ?? '')
    const newPassword = String(data.get('newPassword') ?? '')
    const confirmation = String(data.get('confirmation') ?? '')
    if (newPassword !== confirmation) {
      setError('两次输入的新密码不一致')
      setMessage('')
      return
    }
    setSubmitting(true)
    try {
      await api('/auth/password/change', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      form.reset()
      setError('')
      setMessage('密码已修改，其他设备上的登录会话已退出。')
    } catch (err) {
      setMessage('')
      setError(problemMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <h1>账号设置</h1>
      <form className="panel form-grid narrow" onSubmit={changePassword}>
        <h2>修改密码</h2>
        <p className="muted">密码长度为 12–200 个字符。修改后保留当前登录，退出其他设备。</p>
        <label>
          当前密码
          <input name="currentPassword" type="password" autoComplete="current-password" required />
        </label>
        <label>
          新密码
          <input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={200} required />
        </label>
        <label>
          再次输入新密码
          <input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={200} required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}
        <div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? '修改中…' : '修改密码'}
          </button>
        </div>
      </form>
    </AppShell>
  )
}

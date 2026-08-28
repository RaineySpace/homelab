'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, problemMessage } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: String(form.get('username') ?? ''),
          password: String(form.get('password') ?? ''),
        }),
      })
      router.push('/')
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  return (
    <div className="login">
      <form className="panel grid" onSubmit={onSubmit}>
        <h1>登录家庭</h1>
        <p className="muted">默认账号 admin / changeme，请在生产环境立即修改。</p>
        <label>
          用户名
          <input name="username" defaultValue="admin" autoComplete="username" />
        </label>
        <label>
          密码
          <input name="password" type="password" defaultValue="changeme" autoComplete="current-password" />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit">进入</button>
      </form>
    </div>
  )
}

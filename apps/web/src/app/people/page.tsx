'use client'

import { FormEvent, useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { api, problemMessage } from '@/lib/api'

type Person = { id: string; name: string; sex: string | null; version: number; birth: { year: number } | null }

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [error, setError] = useState('')
  async function refresh() {
    setPeople(await api<Person[]>('/people'))
  }
  useEffect(() => {
    refresh().catch((err) => setError(problemMessage(err)))
  }, [])
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api('/people', {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name')),
          sex: form.get('sex') || null,
          birth: null,
        }),
      })
      event.currentTarget.reset()
      await refresh()
      setError('')
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  async function archive(id: string) {
    await api(`/people/${id}`, { method: 'DELETE' })
    await refresh()
  }
  return (
    <AppShell>
      <h1>家庭人物</h1>
      <form className="panel row" onSubmit={onSubmit}>
        <input name="name" placeholder="姓名" required />
        <select name="sex" defaultValue="">
          <option value="">性别（可选）</option>
          <option value="female">女</option>
          <option value="male">男</option>
          <option value="other">其他</option>
          <option value="unknown">未知</option>
        </select>
        <button className="btn" type="submit">登记</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <div className="cards" style={{ marginTop: 16 }}>
        {people.map((person) => (
          <article className="card" key={person.id}>
            <h2>{person.name}</h2>
            <p className="muted">{person.sex ?? '未填写性别'} · v{person.version}</p>
            <button className="btn secondary" type="button" onClick={() => archive(person.id)}>
              归档
            </button>
          </article>
        ))}
      </div>
    </AppShell>
  )
}

'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { api, problemMessage } from '@/lib/api'

type Task = { id: string; title: string; status: string; completedAt: string | null }

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  async function refresh() {
    setTasks(await api<Task[]>('/tasks'))
  }
  useEffect(() => {
    refresh().catch((err) => setError(problemMessage(err)))
  }, [])
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formEl = formRef.current
    if (!formEl) return
    const form = new FormData(formEl)
    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: String(form.get('title')),
          notes: null,
          assigneePersonId: null,
          dueAt: null,
        }),
      })
      formEl.reset()
      setError('')
      await refresh()
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  async function complete(id: string) {
    await api(`/tasks/${id}/complete`, { method: 'POST' })
    await refresh()
  }
  return (
    <AppShell>
      <h1>家庭任务</h1>
      <form ref={formRef} className="panel row" method="post" onSubmit={onSubmit}>
        <input name="title" placeholder="例如：洗碗" required />
        <button className="btn" type="submit">创建</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <div className="cards" style={{ marginTop: 16 }}>
        {tasks.map((task) => (
          <article className="card" key={task.id}>
            <h2>{task.title}</h2>
            <p className="muted">{task.status}</p>
            {task.status !== 'completed' ? (
              <button className="btn secondary" type="button" onClick={() => complete(task.id)}>完成</button>
            ) : (
              <p className="muted">完成于 {task.completedAt}</p>
            )}
          </article>
        ))}
      </div>
    </AppShell>
  )
}

'use client'

import { FormEvent, useRef, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { api, problemMessage } from '@/lib/api'

type AgentEvent = { type: string; delta?: string; summary?: string; tool?: string }
type AgentRun = {
  id: string
  status: string
  events: AgentEvent[]
}

function formatEvents(events: AgentEvent[]): string {
  const lines: string[] = []
  for (const event of events) {
    if (event.type === 'text.delta' && event.delta) lines.push(event.delta)
    if (event.type === 'tool.started') lines.push(`调用工具 ${event.tool}`)
    if (event.type === 'approval.required') lines.push(`需要确认：${event.summary}`)
    if (event.type === 'run.completed') lines.push('完成。')
    if (event.type === 'run.failed') lines.push('失败。')
  }
  return lines.join('\n')
}

export default function AgentPage() {
  const [log, setLog] = useState('')
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formEl = formRef.current
    if (!formEl) return
    const message = String(new FormData(formEl).get('message'))
    setError('')
    setLog('正在思考…')
    try {
      const run = await api<AgentRun>('/agent/runs', {
        method: 'POST',
        body: JSON.stringify({ message }),
      })
      setLog(formatEvents(run.events) || `状态：${run.status}`)
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  return (
    <AppShell>
      <h1>家庭助手</h1>
      <p className="muted">没有 DeepSeek Key 时使用本地 Stub，仍然走同一套 Command。</p>
      <form ref={formRef} className="panel row" method="post" onSubmit={onSubmit}>
        <input name="message" placeholder="帮我登记一个叫妈妈的人" required style={{ flex: 1 }} />
        <button className="btn" type="submit">发送</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <pre className="stream" style={{ marginTop: 16 }}>{log || '等待消息…'}</pre>
    </AppShell>
  )
}

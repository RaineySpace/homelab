'use client'

import { FormEvent, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { api, problemMessage } from '@/lib/api'

type AgentEvent = { type: string; delta?: string; summary?: string; tool?: string }

export default function AgentPage() {
  const [log, setLog] = useState('')
  const [error, setError] = useState('')
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const message = String(form.get('message'))
    setError('')
    setLog('正在思考…\n')
    try {
      const response = await fetch('/api/v1/agent/runs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message }),
      })
      if (response.status === 401) {
        window.location.href = '/login'
        return
      }
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let text = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split('\n\n')
          buffer = chunks.pop() ?? ''
          for (const chunk of chunks) {
            const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'))
            if (!dataLine) continue
            const event = JSON.parse(dataLine.slice(5).trim()) as AgentEvent
            if (event.type === 'text.delta' && event.delta) text += event.delta
            if (event.type === 'tool.started') text += `\n调用工具 ${event.tool}\n`
            if (event.type === 'approval.required') text += `\n需要确认：${event.summary}\n`
            if (event.type === 'run.completed') text += '\n完成。'
            if (event.type === 'run.failed') text += '\n失败。'
            setLog(text || '…')
          }
        }
        return
      }
      const body = await response.json()
      if (!response.ok) throw body
      const run = await api<{ status: string }>(`/agent/runs/${body.id}`)
      setLog(`Run ${body.id} 状态：${run.status}`)
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  return (
    <AppShell>
      <h1>家庭助手</h1>
      <p className="muted">没有 DeepSeek Key 时使用本地 Stub，仍然走同一套 Command。</p>
      <form className="panel row" onSubmit={onSubmit}>
        <input name="message" placeholder="帮我登记一个叫妈妈的人" required style={{ flex: 1 }} />
        <button className="btn" type="submit">发送</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <pre className="stream" style={{ marginTop: 16 }}>{log || '等待消息…'}</pre>
    </AppShell>
  )
}

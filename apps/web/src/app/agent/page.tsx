'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { BotIcon, SendIcon, SparklesIcon, TerminalSquareIcon } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/page-header'
import { StatusAlert } from '@/components/status-alert'
import { api, problemMessage } from '@/lib/api'
import { Badge } from '@family-os/ui/components/badge'
import { Button } from '@family-os/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@family-os/ui/components/card'
import { Input } from '@family-os/ui/components/input'
import { Label } from '@family-os/ui/components/label'

type AgentEvent = { type: string; delta?: string; summary?: string; tool?: string }
type AgentRun = {
  id: string
  status: string
  events: AgentEvent[]
}

type AgentModel = {
  requestedProvider: string
  activeProvider: string
  usingFallback: boolean
  fallbackReason: string | null
  model: string
  hasApiKey: boolean
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

function statusText(model: AgentModel): string {
  if (model.usingFallback) {
    return '未配置 DEEPSEEK_API_KEY，已回落到本地 Stub。把密钥写进项目根目录的 .env.local（会覆盖 .env；已导出的进程环境变量优先）。'
  }
  return `当前模型：DeepSeek · ${model.model}`
}

export default function AgentPage() {
  const [log, setLog] = useState('')
  const [error, setError] = useState('')
  const [model, setModel] = useState<AgentModel | null>(null)
  const [running, setRunning] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    api<AgentModel>('/agent/model')
      .then(setModel)
      .catch((err) => setError(problemMessage(err)))
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formEl = formRef.current
    if (!formEl) return
    const message = String(new FormData(formEl).get('message'))
    setError('')
    setLog('正在思考…')
    setRunning(true)
    try {
      const run = await api<AgentRun>('/agent/runs', {
        method: 'POST',
        body: JSON.stringify({ message }),
      })
      setLog(formatEvents(run.events) || `状态：${run.status}`)
    } catch (err) {
      setError(problemMessage(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="家庭助手"
        description="用自然语言发起家庭操作；涉及敏感写入时，助手会先请求确认。"
        action={<Badge variant={model?.usingFallback ? 'secondary' : 'outline'}><SparklesIcon />{model?.usingFallback ? '本地 Stub' : model ? model.model : '读取中'}</Badge>}
      />
      <StatusAlert error={error} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BotIcon className="size-5" />告诉助手你想做什么</CardTitle>
          <CardDescription>{model ? statusText(model) : '正在读取当前模型…'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" method="post" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="agent-message">消息</Label>
              <Input id="agent-message" name="message" placeholder="帮我登记一个叫妈妈的人" required />
            </div>
            <Button type="submit" disabled={running}>
              <SendIcon />
              {running ? '处理中…' : '发送'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="bg-neutral-950 text-neutral-100 dark:bg-black">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-neutral-100"><TerminalSquareIcon className="size-5" />运行记录</CardTitle>
          <CardDescription className="text-neutral-400">助手的文本输出、工具调用与确认请求会显示在这里。</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="min-h-44 whitespace-pre-wrap font-mono text-sm leading-6 text-neutral-300">{log || '等待消息…'}</pre>
        </CardContent>
      </Card>
    </AppShell>
  )
}

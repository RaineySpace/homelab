'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { api, problemMessage } from '@/lib/api'

type AgentEvent = { type: string; delta?: string; summary?: string; tool?: string }
type AgentRun = {
  id: string
  status: string
  events: AgentEvent[]
}

type Provider = {
  id: string
  label: string
  protocol: string
  defaultModel: string
  defaultBaseUrl: string
  suggestedModels: string[]
  requiresApiKey: boolean
}

type AgentModel = {
  requestedProvider: string
  activeProvider: string
  usingFallback: boolean
  fallbackReason: string | null
  model: string
  baseUrl: string
  hasApiKey: boolean
  apiKeySource: string
  source: string
  canConfigure: boolean
  providers: Provider[]
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
  const provider = model.providers.find((item) => item.id === model.activeProvider)
  const name = provider?.label ?? model.activeProvider
  if (model.usingFallback) {
    return `当前使用${name}（${model.model}）。已请求 ${model.requestedProvider}，因缺少凭证回落。默认供应商是 DeepSeek。`
  }
  return `当前模型：${name} · ${model.model}`
}

export default function AgentPage() {
  const [log, setLog] = useState('')
  const [error, setError] = useState('')
  const [model, setModel] = useState<AgentModel | null>(null)
  const [saving, setSaving] = useState(false)
  const [providerId, setProviderId] = useState('deepseek')
  const formRef = useRef<HTMLFormElement>(null)
  const settingsRef = useRef<HTMLFormElement>(null)

  async function refreshModel() {
    const next = await api<AgentModel>('/agent/model')
    setModel(next)
    setProviderId(next.requestedProvider)
  }

  useEffect(() => {
    refreshModel().catch((err) => setError(problemMessage(err)))
  }, [])

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

  async function onSaveModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formEl = settingsRef.current
    if (!formEl) return
    const form = new FormData(formEl)
    const provider = String(form.get('provider') ?? '')
    const modelName = String(form.get('model') ?? '').trim()
    const baseUrl = String(form.get('baseUrl') ?? '').trim()
    const apiKey = String(form.get('apiKey') ?? '')
    setSaving(true)
    setError('')
    try {
      const next = await api<AgentModel>('/agent/model', {
        method: 'PUT',
        body: JSON.stringify({
          provider,
          model: modelName || null,
          baseUrl: baseUrl || null,
          ...(apiKey ? { apiKey } : {}),
        }),
      })
      setModel(next)
      const keyInput = formEl.querySelector<HTMLInputElement>('input[name="apiKey"]')
      if (keyInput) keyInput.value = ''
    } catch (err) {
      setError(problemMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const selected = model?.providers.find((item) => item.id === providerId)
  const showBaseUrl = selected?.id === 'openai-compatible' || selected?.id === 'ollama'
  const showApiKey = selected ? selected.requiresApiKey || selected.id === 'openai-compatible' : true

  return (
    <AppShell>
      <h1>家庭助手</h1>
      <p className="muted">{model ? statusText(model) : '正在读取当前模型…'}</p>
      {model?.canConfigure ? (
        <form ref={settingsRef} className="panel grid" onSubmit={onSaveModel} style={{ marginBottom: 16 }}>
          <h2>更换模型</h2>
          <div className="row">
            <label>
              供应商
              <select
                name="provider"
                value={providerId}
                onChange={(event) => setProviderId(event.target.value)}
              >
                {model.providers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {item.id === 'deepseek' ? '（默认）' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              模型名
              <input
                key={`${providerId}-model`}
                name="model"
                defaultValue={model.usingFallback && providerId === model.requestedProvider ? selected?.defaultModel ?? '' : providerId === model.requestedProvider ? model.model : selected?.defaultModel ?? ''}
                placeholder={selected?.defaultModel || '模型 id'}
              />
            </label>
            {showBaseUrl ? (
              <label>
                API 地址
                <input
                  key={`${providerId}-baseUrl`}
                  name="baseUrl"
                  defaultValue={providerId === model.requestedProvider ? model.baseUrl || selected?.defaultBaseUrl : selected?.defaultBaseUrl}
                  placeholder={selected?.defaultBaseUrl || 'https://.../v1'}
                />
              </label>
            ) : null}
            {showApiKey ? (
              <label>
                API Key{model.hasApiKey ? '（已配置，留空则保留）' : ''}
                <input name="apiKey" type="password" autoComplete="off" placeholder={model.hasApiKey ? '已保存' : 'sk-...'} />
              </label>
            ) : null}
            <button className="btn" type="submit" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      ) : null}
      <form ref={formRef} className="panel row" method="post" onSubmit={onSubmit}>
        <input name="message" placeholder="帮我登记一个叫妈妈的人" required style={{ flex: 1 }} />
        <button className="btn" type="submit">发送</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <pre className="stream" style={{ marginTop: 16 }}>{log || '等待消息…'}</pre>
    </AppShell>
  )
}

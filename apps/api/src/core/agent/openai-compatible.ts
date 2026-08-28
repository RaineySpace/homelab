import { Errors } from '../errors.js'
import type { FetchLike, ModelCompleteInput, ModelCompleteResult, ModelGateway, ModelMessage } from './types.js'

function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  return `${trimmed}/chat/completions`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeMessage(raw: {
  role?: string
  content?: string | null
  tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>
}): ModelMessage {
  return {
    role: 'assistant',
    content: raw.content ?? null,
    ...(raw.tool_calls && raw.tool_calls.length > 0
      ? {
          tool_calls: raw.tool_calls.map((call, index) => ({
            id: call.id || `call_${index}`,
            function: {
              name: call.function?.name ?? '',
              arguments: call.function?.arguments ?? '{}',
            },
          })),
        }
      : {}),
  }
}

export class OpenAICompatibleModelGateway implements ModelGateway {
  readonly providerId: string
  readonly model: string

  constructor(
    private readonly options: {
      providerId: string
      label: string
      baseUrl: string
      apiKey: string
      model: string
      timeoutMs: number
      retries: number
      extraBody?: Record<string, unknown>
      fetchImpl?: FetchLike
    },
  ) {
    this.providerId = options.providerId
    this.model = options.model
  }

  async complete(input: ModelCompleteInput): Promise<ModelCompleteResult> {
    if (!this.options.baseUrl) {
      throw Errors.internal(`${this.options.label} 未配置 API 地址`)
    }
    const url = chatCompletionsUrl(this.options.baseUrl)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.options.apiKey) headers.Authorization = `Bearer ${this.options.apiKey}`
    const body = {
      model: this.options.model,
      messages: input.messages,
      tools: input.tools.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      })),
      ...(this.options.extraBody ?? {}),
    }
    const attempts = this.options.retries + 1
    let lastError: unknown
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await (this.options.fetchImpl ?? fetch)(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.options.timeoutMs),
        })
        if (response.ok) {
          const json = (await response.json()) as { choices?: Array<{ message?: Parameters<typeof normalizeMessage>[0] }> }
          const message = json.choices?.[0]?.message
          if (!message) throw Errors.internal(`${this.options.label} 没有返回消息`)
          return { message: normalizeMessage(message) }
        }
        const detail = await response.text()
        if (response.status >= 500 || response.status === 429) {
          lastError = Errors.internal(`${this.options.label} 调用失败：${response.status} ${detail.slice(0, 300)}`)
          if (attempt < attempts - 1) {
            await sleep(250 * 2 ** attempt)
            continue
          }
          throw lastError
        }
        throw Errors.internal(`${this.options.label} 调用失败：${response.status} ${detail.slice(0, 300)}`)
      } catch (error) {
        if (error && typeof error === 'object' && 'status' in error) throw error
        lastError = error
        if (attempt < attempts - 1) {
          await sleep(250 * 2 ** attempt)
          continue
        }
        const detail = error instanceof Error ? error.message : 'unknown'
        throw Errors.internal(`${this.options.label} 调用失败：${detail}`)
      }
    }
    throw lastError instanceof Error ? lastError : Errors.internal(`${this.options.label} 调用失败`)
  }
}

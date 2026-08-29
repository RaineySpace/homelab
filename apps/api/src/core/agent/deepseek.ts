import { createDeepSeek } from '@ai-sdk/deepseek'
import { generateText, jsonSchema as toAiJsonSchema, type ModelMessage as AiModelMessage } from 'ai'
import { AppError, Errors } from '../errors.js'
import type { FetchLike, ModelCompleteInput, ModelCompleteResult, ModelGateway, ModelMessage } from './types.js'

function toolArguments(input: unknown): string {
  if (typeof input === 'string') return input || '{}'
  try {
    return JSON.stringify(input ?? {})
  } catch {
    return '{}'
  }
}

export function toAiSdkMessages(messages: ModelMessage[]): AiModelMessage[] {
  const toolNames = new Map<string, string>()
  const out: AiModelMessage[] = []
  for (const message of messages) {
    if (message.role === 'system' || message.role === 'user') {
      out.push({ role: message.role, content: message.content ?? '' })
      continue
    }
    if (message.role === 'assistant') {
      const toolCalls = (message.tool_calls ?? []).map((call) => {
        let parsed: unknown = {}
        try {
          parsed = JSON.parse(call.function.arguments || '{}')
        } catch {
          parsed = {}
        }
        toolNames.set(call.id, call.function.name)
        return {
          type: 'tool-call' as const,
          toolCallId: call.id,
          toolName: call.function.name,
          input: parsed,
        }
      })
      if (toolCalls.length > 0) {
        out.push({
          role: 'assistant',
          content: [
            ...(message.content?.trim() ? [{ type: 'text' as const, text: message.content }] : []),
            ...toolCalls,
          ],
        })
      } else {
        out.push({ role: 'assistant', content: message.content ?? '' })
      }
      continue
    }
    if (message.role === 'tool') {
      const toolCallId = message.tool_call_id ?? ''
      out.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId,
            toolName: toolNames.get(toolCallId) ?? 'unknown',
            output: { type: 'text', value: message.content ?? '' },
          },
        ],
      })
    }
  }
  return out
}

export class DeepSeekModelGateway implements ModelGateway {
  readonly providerId = 'deepseek'
  readonly model: string

  constructor(
    private readonly options: {
      apiKey: string
      baseUrl: string
      model: string
      timeoutMs: number
      retries: number
      fetchImpl?: FetchLike
    },
  ) {
    this.model = options.model
  }

  async complete(input: ModelCompleteInput): Promise<ModelCompleteResult> {
    try {
      const deepseek = createDeepSeek({
        apiKey: this.options.apiKey,
        baseURL: this.options.baseUrl,
        fetch: this.options.fetchImpl,
      })
      const tools = Object.fromEntries(
        input.tools.map((tool) => [
          tool.name,
          {
            description: tool.description,
            inputSchema: toAiJsonSchema(tool.parameters as Parameters<typeof toAiJsonSchema>[0]),
          },
        ]),
      )
      const result = await generateText({
        model: deepseek(this.options.model),
        messages: toAiSdkMessages(input.messages),
        tools,
        maxRetries: this.options.retries,
        timeout: this.options.timeoutMs,
        providerOptions: {
          deepseek: { thinking: { type: 'disabled' } },
        },
      })
      if (result.toolCalls.length > 0) {
        return {
          message: {
            role: 'assistant',
            content: result.text || null,
            tool_calls: result.toolCalls.map((call) => ({
              id: call.toolCallId,
              function: {
                name: call.toolName,
                arguments: toolArguments(call.input),
              },
            })),
          },
        }
      }
      return {
        message: {
          role: 'assistant',
          content: result.text,
        },
      }
    } catch (error) {
      if (error instanceof AppError) throw error
      const detail = error instanceof Error ? error.message : 'unknown'
      throw Errors.internal(`DeepSeek 调用失败：${detail}`)
    }
  }
}

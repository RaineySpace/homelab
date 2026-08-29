import { describe, expect, it, vi } from 'vitest'
import { loadEnv } from '../../env.js'
import { createModelGateway } from './factory.js'
import { resolveModelSelection } from './resolve.js'
import { DeepSeekModelGateway, toAiSdkMessages } from './deepseek.js'
import { StubModelGateway } from './stub.js'

function env(overrides: Record<string, string> = {}) {
  return loadEnv({
    DATA_DIR: ':memory:',
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-session-secret-change-me',
    NODE_ENV: 'test',
    ...overrides,
  })
}

function deepSeekResponse(message: { role?: string; content?: string | null; tool_calls?: unknown[] }, finishReason = 'stop') {
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: 'assistant', ...message }, finish_reason: finishReason }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

describe('DeepSeek model gateway', () => {
  it('defaults to DeepSeek and falls back to stub without a key', () => {
    const selection = resolveModelSelection(env())
    expect(selection.requestedProvider).toBe('deepseek')
    expect(selection.activeProvider).toBe('stub')
    expect(selection.usingFallback).toBe(true)
    expect(selection.fallbackReason).toBe('missing_api_key')
    expect(selection.model).toBe('stub')
    expect(selection.source).toBe('env')
  })

  it('uses DeepSeek V4 flash when a key is present', () => {
    const selection = resolveModelSelection(env({ DEEPSEEK_API_KEY: 'sk-test' }))
    expect(selection.activeProvider).toBe('deepseek')
    expect(selection.usingFallback).toBe(false)
    expect(selection.model).toBe('deepseek-v4-flash')
    expect(selection.baseUrl).toBe('https://api.deepseek.com')
    expect(selection.hasApiKey).toBe(true)
  })

  it('builds a DeepSeek AI SDK gateway when a key is present', () => {
    const { gateway, selection } = createModelGateway(env({ DEEPSEEK_API_KEY: 'sk-test' }))
    expect(selection.activeProvider).toBe('deepseek')
    expect(gateway).toBeInstanceOf(DeepSeekModelGateway)
    expect(gateway.providerId).toBe('deepseek')
    expect(gateway.model).toBe('deepseek-v4-flash')
  })

  it('builds the stub gateway when no key is configured', () => {
    const { gateway } = createModelGateway(env())
    expect(gateway).toBeInstanceOf(StubModelGateway)
  })

  it('calls DeepSeek via AI SDK with thinking disabled', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
      deepSeekResponse({ content: '你好' }),
    )
    const gateway = new DeepSeekModelGateway({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      timeoutMs: 5_000,
      retries: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const result = await gateway.complete({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ name: 'people.list', description: 'list', parameters: { type: 'object', properties: {} } }],
    })
    expect(result.message.content).toBe('你好')
    expect(fetchImpl).toHaveBeenCalled()
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(String(url)).toBe('https://api.deepseek.com/chat/completions')
    const body = JSON.parse(String(init?.body)) as {
      model: string
      thinking: unknown
      tools: Array<{ function: { name: string } }>
    }
    expect(body.model).toBe('deepseek-v4-flash')
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.tools[0]?.function.name).toBe('people.list')
    const headers = init?.headers as Headers | Record<string, string> | undefined
    const auth = headers instanceof Headers ? headers.get('authorization') ?? headers.get('Authorization') : headers?.Authorization ?? headers?.authorization
    expect(auth).toBe('Bearer sk-test')
  })

  it('maps AI SDK tool calls back to the internal message shape', async () => {
    const fetchImpl = vi.fn(async () =>
      deepSeekResponse(
        {
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'people.create', arguments: '{"name":"妈妈"}' },
            },
          ],
        },
        'tool_calls',
      ),
    )
    const gateway = new DeepSeekModelGateway({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      timeoutMs: 5_000,
      retries: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const result = await gateway.complete({
      messages: [{ role: 'user', content: '登记妈妈' }],
      tools: [
        {
          name: 'people.create',
          description: 'create',
          parameters: { type: 'object', properties: { name: { type: 'string' } } },
        },
      ],
    })
    expect(result.message.tool_calls?.[0]?.function.name).toBe('people.create')
    expect(JSON.parse(result.message.tool_calls?.[0]?.function.arguments ?? '{}')).toEqual({ name: '妈妈' })
  })

  it('converts internal tool-loop messages into AI SDK messages', () => {
    const converted = toAiSdkMessages([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_1', function: { name: 'people.list', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '[]' },
    ])
    expect(converted[1]).toMatchObject({
      role: 'assistant',
      content: [{ type: 'tool-call', toolCallId: 'call_1', toolName: 'people.list' }],
    })
    expect(converted[2]).toMatchObject({
      role: 'tool',
      content: [{ type: 'tool-result', toolCallId: 'call_1', toolName: 'people.list' }],
    })
  })
})

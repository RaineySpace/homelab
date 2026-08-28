import { describe, expect, it, vi } from 'vitest'
import { loadEnv } from '../../env.js'
import { createModelGateway } from './factory.js'
import { resolveModelSelection } from './resolve.js'
import { OpenAICompatibleModelGateway } from './openai-compatible.js'
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

describe('model provider registry', () => {
  it('defaults to deepseek and falls back to stub without a key', () => {
    const selection = resolveModelSelection(env({ AGENT_MODEL_PROVIDER: 'deepseek' }))
    expect(selection.requestedProvider).toBe('deepseek')
    expect(selection.activeProvider).toBe('stub')
    expect(selection.usingFallback).toBe(true)
    expect(selection.fallbackReason).toBe('missing_api_key')
    expect(selection.model).toBe('stub')
  })

  it('uses DeepSeek V4 flash when a key is present', () => {
    const selection = resolveModelSelection(
      env({
        AGENT_MODEL_PROVIDER: 'deepseek',
        DEEPSEEK_API_KEY: 'sk-test',
      }),
    )
    expect(selection.activeProvider).toBe('deepseek')
    expect(selection.usingFallback).toBe(false)
    expect(selection.model).toBe('deepseek-v4-flash')
    expect(selection.baseUrl).toBe('https://api.deepseek.com')
    expect(selection.apiKeySource).toBe('env')
    expect(selection.extraBody).toEqual({ thinking: { type: 'disabled' } })
  })

  it('lets household settings override env provider', () => {
    const selection = resolveModelSelection(env({ AGENT_MODEL_PROVIDER: 'deepseek', OPENAI_API_KEY: 'sk-openai' }), {
      provider: 'openai',
      model: 'gpt-4o-mini',
      baseUrl: null,
      apiKey: null,
    })
    expect(selection.source).toBe('household')
    expect(selection.activeProvider).toBe('openai')
    expect(selection.baseUrl).toBe('https://api.openai.com/v1')
  })

  it('builds an OpenAI-compatible gateway for DeepSeek', () => {
    const { gateway, selection } = createModelGateway(env({ DEEPSEEK_API_KEY: 'sk-test', AGENT_MODEL_PROVIDER: 'deepseek' }))
    expect(selection.activeProvider).toBe('deepseek')
    expect(gateway).toBeInstanceOf(OpenAICompatibleModelGateway)
    expect(gateway.providerId).toBe('deepseek')
    expect(gateway.model).toBe('deepseek-v4-flash')
  })

  it('builds the stub gateway when tests opt in', () => {
    const { gateway } = createModelGateway(env({ AGENT_MODEL_PROVIDER: 'stub' }))
    expect(gateway).toBeInstanceOf(StubModelGateway)
  })

  it('calls chat completions with the OpenAI-compatible payload', async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: '你好' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    const gateway = new OpenAICompatibleModelGateway({
      providerId: 'deepseek',
      label: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      model: 'deepseek-v4-flash',
      timeoutMs: 5_000,
      retries: 0,
      extraBody: { thinking: { type: 'disabled' } },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const result = await gateway.complete({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ name: 'people.list', description: 'list', parameters: { type: 'object' } }],
    })
    expect(result.message.content).toBe('你好')
    expect(fetchImpl).toHaveBeenCalledOnce()
    const init = fetchImpl.mock.calls[0]?.[1]
    const body = JSON.parse(String(init?.body)) as {
      model: string
      thinking: unknown
      tools: Array<{ function: { name: string } }>
    }
    expect(body.model).toBe('deepseek-v4-flash')
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.tools[0]?.function.name).toBe('people.list')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
  })
})

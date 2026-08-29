import { MODEL_PROVIDERS, type ModelProviderId } from './catalog.js'
import type { Env } from '../../env.js'

export type ModelSelection = {
  requestedProvider: 'deepseek'
  activeProvider: ModelProviderId
  usingFallback: boolean
  fallbackReason: 'missing_api_key' | null
  model: string
  baseUrl: string
  hasApiKey: boolean
  source: 'env'
  timeoutMs: number
  retries: number
}

export function resolveModelSelection(env: Env): ModelSelection {
  const apiKey = env.DEEPSEEK_API_KEY.trim()
  const model = env.DEEPSEEK_MODEL.trim() || MODEL_PROVIDERS.deepseek.defaultModel
  const baseUrl = env.DEEPSEEK_BASE_URL.trim() || MODEL_PROVIDERS.deepseek.defaultBaseUrl
  const timeoutMs = env.AGENT_MODEL_TIMEOUT_MS
  const retries = env.AGENT_MODEL_RETRIES
  if (!apiKey) {
    return {
      requestedProvider: 'deepseek',
      activeProvider: 'stub',
      usingFallback: true,
      fallbackReason: 'missing_api_key',
      model: MODEL_PROVIDERS.stub.defaultModel,
      baseUrl: '',
      hasApiKey: false,
      source: 'env',
      timeoutMs,
      retries,
    }
  }
  return {
    requestedProvider: 'deepseek',
    activeProvider: 'deepseek',
    usingFallback: false,
    fallbackReason: null,
    model,
    baseUrl,
    hasApiKey: true,
    source: 'env',
    timeoutMs,
    retries,
  }
}

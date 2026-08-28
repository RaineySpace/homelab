import { Errors } from '../errors.js'
import { isModelProviderId, MODEL_PROVIDERS, type ModelProviderId } from './catalog.js'
import type { HouseholdModelOverride } from './types.js'
import type { Env } from '../../env.js'

export type ModelSelection = {
  requestedProvider: ModelProviderId
  activeProvider: ModelProviderId
  usingFallback: boolean
  fallbackReason: 'missing_api_key' | 'missing_base_url' | 'missing_model' | null
  model: string
  baseUrl: string
  hasApiKey: boolean
  apiKey: string
  apiKeySource: 'household' | 'env' | 'none'
  source: 'household' | 'env'
  extraBody?: Record<string, unknown>
  timeoutMs: number
  retries: number
}

function envValue(env: Env, key: string | undefined): string {
  if (!key) return ''
  const value = (env as unknown as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function firstText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (value && value.trim()) return value.trim()
  }
  return ''
}

type Built = {
  provider: ModelProviderId
  model: string
  baseUrl: string
  apiKey: string
  apiKeySource: ModelSelection['apiKeySource']
  extraBody?: Record<string, unknown>
  timeoutMs: number
  retries: number
  activeReady: boolean
  unreadyReason: ModelSelection['fallbackReason']
}

function buildSelection(env: Env, household: HouseholdModelOverride | null | undefined, provider: ModelProviderId): Built {
  const preset = MODEL_PROVIDERS[provider]
  const householdApplies = household?.provider === provider
  const model = firstText(
    householdApplies ? household?.model : undefined,
    env.AGENT_MODEL,
    envValue(env, preset.env.model),
    preset.defaultModel,
  )
  const baseUrl = firstText(
    householdApplies ? household?.baseUrl : undefined,
    env.AGENT_BASE_URL,
    envValue(env, preset.env.baseUrl),
    preset.defaultBaseUrl,
  )
  const householdKey = householdApplies ? household?.apiKey?.trim() ?? '' : ''
  const envKey = firstText(env.AGENT_API_KEY, envValue(env, preset.env.apiKey))
  const apiKey = householdKey || envKey
  const apiKeySource: ModelSelection['apiKeySource'] = householdKey ? 'household' : envKey ? 'env' : 'none'
  let unreadyReason: ModelSelection['fallbackReason'] = null
  if (preset.protocol === 'openai-compatible' && !baseUrl) unreadyReason = 'missing_base_url'
  else if (preset.protocol === 'openai-compatible' && !model) unreadyReason = 'missing_model'
  else if (preset.requiresApiKey && !apiKey) unreadyReason = 'missing_api_key'
  return {
    provider,
    model: model || preset.defaultModel,
    baseUrl,
    apiKey,
    apiKeySource,
    extraBody: preset.extraBody,
    timeoutMs: env.AGENT_MODEL_TIMEOUT_MS,
    retries: env.AGENT_MODEL_RETRIES,
    activeReady: unreadyReason == null,
    unreadyReason,
  }
}

export function resolveModelSelection(env: Env, household?: HouseholdModelOverride | null): ModelSelection {
  const source: ModelSelection['source'] = household?.provider ? 'household' : 'env'
  const requestedRaw = household?.provider || env.AGENT_MODEL_PROVIDER
  if (!isModelProviderId(requestedRaw)) {
    throw Errors.validation('不支持的模型供应商', [
      { path: ['provider'], code: 'invalid', message: `未知供应商 ${requestedRaw}` },
    ])
  }
  const requested = buildSelection(env, household, requestedRaw)
  if (requested.activeReady) {
    return {
      requestedProvider: requestedRaw,
      activeProvider: requested.provider,
      usingFallback: false,
      fallbackReason: null,
      model: requested.model,
      baseUrl: requested.baseUrl,
      hasApiKey: requested.apiKeySource !== 'none',
      apiKey: requested.apiKey,
      apiKeySource: requested.apiKeySource,
      source,
      extraBody: requested.extraBody,
      timeoutMs: requested.timeoutMs,
      retries: requested.retries,
    }
  }

  if (env.AGENT_FALLBACK_PROVIDER === 'stub' && requestedRaw !== 'stub') {
    const stub = buildSelection(env, null, 'stub')
    return {
      requestedProvider: requestedRaw,
      activeProvider: 'stub',
      usingFallback: true,
      fallbackReason: requested.unreadyReason,
      model: stub.model,
      baseUrl: stub.baseUrl,
      hasApiKey: false,
      apiKey: '',
      apiKeySource: 'none',
      source,
      extraBody: stub.extraBody,
      timeoutMs: stub.timeoutMs,
      retries: stub.retries,
    }
  }

  const label = MODEL_PROVIDERS[requestedRaw].label
  const detail =
    requested.unreadyReason === 'missing_api_key'
      ? `${label} 需要 API Key`
      : requested.unreadyReason === 'missing_base_url'
        ? `${label} 需要 API 地址`
        : `${label} 需要模型名`
  throw Errors.internal(detail)
}

export const MODEL_PROVIDER_IDS = ['deepseek', 'openai', 'ollama', 'openai-compatible', 'stub'] as const

export type ModelProviderId = (typeof MODEL_PROVIDER_IDS)[number]

export type ModelProtocol = 'openai-compatible' | 'stub'

export type ProviderPreset = {
  id: ModelProviderId
  label: string
  protocol: ModelProtocol
  defaultBaseUrl: string
  defaultModel: string
  suggestedModels: string[]
  requiresApiKey: boolean
  env: {
    apiKey?: EnvKeyName
    baseUrl?: EnvKeyName
    model?: EnvKeyName
  }
  extraBody?: Record<string, unknown>
}

type EnvKeyName =
  | 'DEEPSEEK_API_KEY'
  | 'DEEPSEEK_BASE_URL'
  | 'DEEPSEEK_MODEL'
  | 'OPENAI_API_KEY'
  | 'OPENAI_BASE_URL'
  | 'OPENAI_MODEL'
  | 'OLLAMA_API_KEY'
  | 'OLLAMA_BASE_URL'
  | 'OLLAMA_MODEL'
  | 'AGENT_API_KEY'
  | 'AGENT_BASE_URL'
  | 'AGENT_MODEL'

export const MODEL_PROVIDERS: Record<ModelProviderId, ProviderPreset> = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    suggestedModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    requiresApiKey: true,
    env: { apiKey: 'DEEPSEEK_API_KEY', baseUrl: 'DEEPSEEK_BASE_URL', model: 'DEEPSEEK_MODEL' },
    // V4 默认开启 thinking；工具循环关闭它，对齐已退役的 deepseek-chat。
    extraBody: { thinking: { type: 'disabled' } },
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o-mini', 'gpt-4o'],
    requiresApiKey: true,
    env: { apiKey: 'OPENAI_API_KEY', baseUrl: 'OPENAI_BASE_URL', model: 'OPENAI_MODEL' },
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'qwen2.5',
    suggestedModels: ['qwen2.5', 'llama3.2'],
    requiresApiKey: false,
    env: { apiKey: 'OLLAMA_API_KEY', baseUrl: 'OLLAMA_BASE_URL', model: 'OLLAMA_MODEL' },
  },
  'openai-compatible': {
    id: 'openai-compatible',
    label: 'OpenAI 兼容',
    protocol: 'openai-compatible',
    defaultBaseUrl: '',
    defaultModel: '',
    suggestedModels: [],
    requiresApiKey: false,
    env: { apiKey: 'AGENT_API_KEY', baseUrl: 'AGENT_BASE_URL', model: 'AGENT_MODEL' },
  },
  stub: {
    id: 'stub',
    label: '本地 Stub',
    protocol: 'stub',
    defaultBaseUrl: '',
    defaultModel: 'stub',
    suggestedModels: ['stub'],
    requiresApiKey: false,
    env: {},
  },
}

export function isModelProviderId(value: string): value is ModelProviderId {
  return (MODEL_PROVIDER_IDS as readonly string[]).includes(value)
}

export function listProviderCatalog() {
  return MODEL_PROVIDER_IDS.map((id) => {
    const preset = MODEL_PROVIDERS[id]
    return {
      id: preset.id,
      label: preset.label,
      protocol: preset.protocol,
      defaultModel: preset.defaultModel,
      defaultBaseUrl: preset.defaultBaseUrl,
      suggestedModels: preset.suggestedModels,
      requiresApiKey: preset.requiresApiKey,
    }
  })
}

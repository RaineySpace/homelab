export const MODEL_PROVIDER_IDS = ['deepseek', 'stub'] as const

export type ModelProviderId = (typeof MODEL_PROVIDER_IDS)[number]

export type ProviderPreset = {
  id: ModelProviderId
  label: string
  defaultBaseUrl: string
  defaultModel: string
  suggestedModels: string[]
  requiresApiKey: boolean
}

export const MODEL_PROVIDERS: Record<ModelProviderId, ProviderPreset> = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    suggestedModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    requiresApiKey: true,
  },
  stub: {
    id: 'stub',
    label: '本地 Stub',
    defaultBaseUrl: '',
    defaultModel: 'stub',
    suggestedModels: ['stub'],
    requiresApiKey: false,
  },
}

export function isModelProviderId(value: string): value is ModelProviderId {
  return (MODEL_PROVIDER_IDS as readonly string[]).includes(value)
}

/** 首期对外只展示 DeepSeek；Stub 是无 Key 时的内部回落。 */
export function listProviderCatalog(): Array<{
  id: 'deepseek'
  label: string
  defaultModel: string
  defaultBaseUrl: string
  suggestedModels: string[]
  requiresApiKey: boolean
}> {
  const preset = MODEL_PROVIDERS.deepseek
  return [
    {
      id: 'deepseek',
      label: preset.label,
      defaultModel: preset.defaultModel,
      defaultBaseUrl: preset.defaultBaseUrl,
      suggestedModels: preset.suggestedModels,
      requiresApiKey: preset.requiresApiKey,
    },
  ]
}

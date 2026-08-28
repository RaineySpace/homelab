export type ModelRole = 'system' | 'user' | 'assistant' | 'tool'

export type ModelMessage = {
  role: ModelRole
  content: string | null
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

export type ModelToolSpec = {
  name: string
  description: string
  parameters: unknown
}

export type ModelCompleteInput = {
  messages: ModelMessage[]
  tools: ModelToolSpec[]
}

export type ModelCompleteResult = {
  message: ModelMessage
}

export interface ModelGateway {
  readonly providerId: string
  readonly model: string
  complete(input: ModelCompleteInput): Promise<ModelCompleteResult>
}

export type FetchLike = typeof fetch

export type HouseholdModelOverride = {
  provider: string | null
  model: string | null
  baseUrl: string | null
  apiKey: string | null
}

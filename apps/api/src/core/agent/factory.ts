import { MODEL_PROVIDERS } from './catalog.js'
import { OpenAICompatibleModelGateway } from './openai-compatible.js'
import { resolveModelSelection, type ModelSelection } from './resolve.js'
import { StubModelGateway } from './stub.js'
import type { FetchLike, HouseholdModelOverride, ModelGateway } from './types.js'
import type { Env } from '../../env.js'

export function createModelGateway(
  env: Env,
  household?: HouseholdModelOverride | null,
  fetchImpl?: FetchLike,
): { gateway: ModelGateway; selection: ModelSelection } {
  const selection = resolveModelSelection(env, household)
  const preset = MODEL_PROVIDERS[selection.activeProvider]
  if (preset.protocol === 'stub') {
    return { gateway: new StubModelGateway(), selection }
  }
  return {
    gateway: new OpenAICompatibleModelGateway({
      providerId: selection.activeProvider,
      label: preset.label,
      baseUrl: selection.baseUrl,
      apiKey: selection.apiKey,
      model: selection.model,
      timeoutMs: selection.timeoutMs,
      retries: selection.retries,
      extraBody: selection.extraBody,
      fetchImpl,
    }),
    selection,
  }
}

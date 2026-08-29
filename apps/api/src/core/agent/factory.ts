import { DeepSeekModelGateway } from './deepseek.js'
import { resolveModelSelection, type ModelSelection } from './resolve.js'
import { StubModelGateway } from './stub.js'
import type { FetchLike, ModelGateway } from './types.js'
import type { Env } from '../../env.js'

export function createModelGateway(
  env: Env,
  options?: { fetch?: FetchLike },
): { gateway: ModelGateway; selection: ModelSelection } {
  const selection = resolveModelSelection(env)
  if (selection.activeProvider === 'stub') {
    return { gateway: new StubModelGateway(), selection }
  }
  return {
    gateway: new DeepSeekModelGateway({
      apiKey: env.DEEPSEEK_API_KEY,
      baseUrl: selection.baseUrl,
      model: selection.model,
      timeoutMs: selection.timeoutMs,
      retries: selection.retries,
      fetchImpl: options?.fetch,
    }),
    selection,
  }
}

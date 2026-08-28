import { eq } from 'drizzle-orm'
import { decryptSecret, encryptSecret } from '../crypto.js'
import { householdAgentModels } from '../database/schema.js'
import { nowIso } from '../ids.js'
import type { Db } from '../database/client.js'
import type { Env } from '../../env.js'
import type { HouseholdModelOverride } from './types.js'
import { isModelProviderId, type ModelProviderId } from './catalog.js'
import { Errors } from '../errors.js'

export type HouseholdAgentModelRow = {
  provider: ModelProviderId
  model: string | null
  baseUrl: string | null
  hasHouseholdApiKey: boolean
}

export function readHouseholdOverride(db: Db, env: Env, householdId: string): HouseholdModelOverride | null {
  const row = db.select().from(householdAgentModels).where(eq(householdAgentModels.householdId, householdId)).get()
  if (!row) return null
  const apiKey = row.apiKeyCipher ? decryptSecret(row.apiKeyCipher, env.SESSION_SECRET) : null
  return {
    provider: row.provider,
    model: row.model,
    baseUrl: row.baseUrl,
    apiKey,
  }
}

export function readHouseholdAgentModel(db: Db, householdId: string): HouseholdAgentModelRow | null {
  const row = db.select().from(householdAgentModels).where(eq(householdAgentModels.householdId, householdId)).get()
  if (!row || !isModelProviderId(row.provider)) return null
  return {
    provider: row.provider,
    model: row.model,
    baseUrl: row.baseUrl,
    hasHouseholdApiKey: Boolean(row.apiKeyCipher),
  }
}

export function saveHouseholdAgentModel(
  db: Db,
  env: Env,
  householdId: string,
  input: {
    provider: ModelProviderId
    model: string | null
    baseUrl: string | null
    apiKey?: string | null
  },
): HouseholdAgentModelRow {
  if (input.provider === 'openai-compatible' && !input.baseUrl) {
    throw Errors.validation('OpenAI 兼容端点需要 API 地址', [
      { path: ['baseUrl'], code: 'required', message: '请填写 baseUrl' },
    ])
  }
  if (input.provider === 'openai-compatible' && !input.model) {
    throw Errors.validation('OpenAI 兼容端点需要模型名', [
      { path: ['model'], code: 'required', message: '请填写 model' },
    ])
  }
  const existing = db.select().from(householdAgentModels).where(eq(householdAgentModels.householdId, householdId)).get()
  let apiKeyCipher = existing?.apiKeyCipher ?? null
  if (existing && existing.provider !== input.provider && input.apiKey === undefined) {
    apiKeyCipher = null
  }
  if (input.apiKey === null || input.apiKey === '') apiKeyCipher = null
  else if (typeof input.apiKey === 'string') apiKeyCipher = encryptSecret(input.apiKey, env.SESSION_SECRET)
  const at = nowIso()
  const values = {
    householdId,
    provider: input.provider,
    model: input.model,
    baseUrl: input.baseUrl,
    apiKeyCipher,
    updatedAt: at,
  }
  if (existing) {
    db.update(householdAgentModels).set(values).where(eq(householdAgentModels.householdId, householdId)).run()
  } else {
    db.insert(householdAgentModels).values(values).run()
  }
  return {
    provider: input.provider,
    model: input.model,
    baseUrl: input.baseUrl,
    hasHouseholdApiKey: Boolean(apiKeyCipher),
  }
}

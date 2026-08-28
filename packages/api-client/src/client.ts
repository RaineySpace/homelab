import createClient from 'openapi-fetch'
import type { paths } from './schema.js'

const browserBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'

export function createBrowserApiClient() {
  return createClient<paths>({
    baseUrl: browserBase,
    credentials: 'include',
  })
}

export function createServerApiClient(cookie?: string) {
  const baseUrl = process.env.INTERNAL_API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1'
  return createClient<paths>({
    baseUrl,
    headers: cookie ? { cookie } : undefined,
  })
}

export const apiClient = createBrowserApiClient()

export type { paths }

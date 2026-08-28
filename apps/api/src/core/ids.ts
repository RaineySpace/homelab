import { customAlphabet } from 'nanoid'

const alphabet = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16)

export function createId(prefix: string): string {
  return `${prefix}_${alphabet()}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

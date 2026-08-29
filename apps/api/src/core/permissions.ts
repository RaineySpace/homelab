export type Role = 'owner' | 'member' | 'viewer'

export const PERMISSIONS = [
  'people:read',
  'people:create',
  'people:update',
  'people:archive',
  'ingredients:read',
  'ingredients:create',
  'recipes:read',
  'recipes:create',
  'recipes:update',
  'recipes:archive',
  'meals:read',
  'meals:compose',
  'meals:confirm',
  'meals:complete',
  'meals:rate',
  'tasks:read',
  'tasks:create',
  'tasks:update',
  'tasks:complete',
  'agent:run',
  'agent:approve',
  'accounts:read',
  'accounts:create',
  'accounts:update',
  'accounts:reset-password',
  'accounts:disable',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const BUSINESS: Permission[] = PERMISSIONS.filter((item) => !item.startsWith('accounts:'))
const VIEWER: Permission[] = BUSINESS.filter((item) => item.endsWith(':read'))

export function permissionsForRole(role: Role): Permission[] {
  if (role === 'viewer') return VIEWER
  if (role === 'member') return BUSINESS
  return [...PERMISSIONS]
}

export type RequestIdentity = {
  accountId: string
  householdId: string
  sessionId: string
  permissions: Permission[]
  authMethod: 'cookie' | 'bearer'
  role: Role
  username: string
  person: { id: string; name: string }
}

export function hasPermission(identity: RequestIdentity, permission: Permission): boolean {
  return identity.permissions.includes(permission)
}

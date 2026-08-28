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
] as const

export type Permission = (typeof PERMISSIONS)[number]

const MEMBER: Permission[] = [...PERMISSIONS]

const VIEWER: Permission[] = PERMISSIONS.filter((item) => item.endsWith(':read'))

export function permissionsForRole(role: Role): Permission[] {
  if (role === 'owner') return [...PERMISSIONS]
  if (role === 'member') return MEMBER
  return VIEWER
}

export type RequestIdentity = {
  accountId: string
  householdId: string
  sessionId: string
  permissions: Permission[]
  authMethod: 'cookie' | 'bearer'
  role: Role
  username: string
}

export function hasPermission(identity: RequestIdentity, permission: Permission): boolean {
  return identity.permissions.includes(permission)
}

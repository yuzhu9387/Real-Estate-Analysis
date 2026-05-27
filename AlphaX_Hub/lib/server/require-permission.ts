import 'server-only'
import { getCurrentUser } from './get-current-user'
import { can, type Action } from '@/lib/permissions'
import { UnauthorizedError, ForbiddenError } from './errors'
import type { User } from '@/db/schema'

export async function requirePermission(action: Action): Promise<User> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError()
  if (!can(user, action)) throw new ForbiddenError(`Denied: ${action.type}`)
  return user
}

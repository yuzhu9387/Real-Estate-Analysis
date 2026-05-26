import { ProjectLockedError } from '@/lib/server/errors'
import type { ProjectStatus } from './project'

export function assertProjectStructureMutable(status: ProjectStatus): void {
  if (status !== 'draft') throw new ProjectLockedError(status)
}

export function assertProjectMetaMutable(status: ProjectStatus): void {
  if (status === 'complete' || status === 'archived') throw new ProjectLockedError(status)
}

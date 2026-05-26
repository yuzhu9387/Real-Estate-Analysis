import { InvalidTransitionError } from '@/lib/server/errors'

export type ProjectStatus = 'draft' | 'in_progress' | 'complete' | 'archived'

const ALLOWED: Record<ProjectStatus, ProjectStatus[]> = {
  draft:       ['in_progress'],
  in_progress: ['complete', 'draft'],
  complete:    ['archived', 'draft'],
  archived:    ['draft'],
}

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

export function assertProjectTransition(from: ProjectStatus, to: ProjectStatus): void {
  if (!canTransitionProject(from, to)) throw new InvalidTransitionError(from, to)
}

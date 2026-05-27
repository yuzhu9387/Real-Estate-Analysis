import { InvalidTransitionError } from '@/lib/server/errors'

export type PhaseStatus = 'pending' | 'in_progress' | 'complete'

const ALLOWED: Record<PhaseStatus, PhaseStatus[]> = {
  pending:     ['in_progress'],
  in_progress: ['complete'],
  complete:    [],
}

export function canTransitionPhase(from: PhaseStatus, to: PhaseStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

export function assertPhaseTransition(from: PhaseStatus, to: PhaseStatus): void {
  if (!canTransitionPhase(from, to)) throw new InvalidTransitionError(from, to)
}

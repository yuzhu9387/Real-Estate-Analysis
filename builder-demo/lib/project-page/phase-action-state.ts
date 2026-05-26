import type { ProjectPhase } from '@/db/schema'

export type PhaseActionState = {
  visible: boolean
  enabled: boolean
  label?: string
  action?: 'kick_off' | 'mark_complete'
  disabledReason?: string
}

export function phaseActionState(
  phase: Pick<ProjectPhase, 'id' | 'name' | 'sortOrder' | 'status'>,
  earlierPhases: Array<Pick<ProjectPhase, 'sortOrder' | 'status'>>,
): PhaseActionState {
  if (phase.status === 'complete') return { visible: false, enabled: false }
  if (phase.status === 'in_progress') {
    return { visible: true, enabled: true, label: 'Mark Phase Complete', action: 'mark_complete' }
  }
  const earliers = earlierPhases.filter(p => p.sortOrder < phase.sortOrder)
  const allEarlierComplete = earliers.every(p => p.status === 'complete')
  if (!allEarlierComplete) {
    return { visible: true, enabled: false, label: 'Kick Off Phase', action: 'kick_off',
      disabledReason: 'Earlier phase must be complete first' }
  }
  return { visible: true, enabled: true, label: 'Kick Off Phase', action: 'kick_off' }
}

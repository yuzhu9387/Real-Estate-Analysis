import { describe, it, expect } from 'vitest'
import { phaseActionState } from './phase-action-state'

describe('phaseActionState', () => {
  const permitting = { id: 'p', name: 'Permitting' as const, sortOrder: 1, status: 'pending' as const }
  const construction = { id: 'c', name: 'Construction' as const, sortOrder: 2, status: 'pending' as const }

  it('first phase pending → Kick Off enabled', () => {
    expect(phaseActionState(permitting, [])).toMatchObject({
      label: 'Kick Off Phase', visible: true, enabled: true, action: 'kick_off',
    })
  })

  it('second phase pending while first not complete → disabled', () => {
    const out = phaseActionState(construction, [{ ...permitting, status: 'in_progress' }])
    expect(out.visible).toBe(true)
    expect(out.enabled).toBe(false)
    expect(out.disabledReason).toContain('Earlier phase')
  })

  it('phase in_progress → Mark Phase Complete', () => {
    expect(phaseActionState({ ...permitting, status: 'in_progress' }, [])).toMatchObject({
      label: 'Mark Phase Complete', visible: true, enabled: true, action: 'mark_complete',
    })
  })

  it('phase complete → button hidden', () => {
    expect(phaseActionState({ ...permitting, status: 'complete' }, [])).toMatchObject({
      visible: false,
    })
  })
})

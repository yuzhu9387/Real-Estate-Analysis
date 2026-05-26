import { describe, it, expect } from 'vitest'
import { canTransitionProject, assertProjectTransition } from './project'
import { InvalidTransitionError } from '@/lib/server/errors'

describe('project state transitions', () => {
  it('allows draft → in_progress', () => {
    expect(canTransitionProject('draft', 'in_progress')).toBe(true)
  })
  it('allows in_progress → complete', () => {
    expect(canTransitionProject('in_progress', 'complete')).toBe(true)
  })
  it('allows complete → archived', () => {
    expect(canTransitionProject('complete', 'archived')).toBe(true)
  })
  it('allows any → draft (owner override)', () => {
    for (const s of ['in_progress','complete','archived'] as const) {
      expect(canTransitionProject(s, 'draft')).toBe(true)
    }
  })
  it('rejects draft → complete (skipping)', () => {
    expect(canTransitionProject('draft', 'complete')).toBe(false)
  })
  it('rejects archived → in_progress', () => {
    expect(canTransitionProject('archived', 'in_progress')).toBe(false)
  })
  it('assertProjectTransition throws on illegal', () => {
    expect(() => assertProjectTransition('archived', 'in_progress')).toThrow(InvalidTransitionError)
  })
})

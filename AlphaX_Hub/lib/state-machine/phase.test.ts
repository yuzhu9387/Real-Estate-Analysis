import { describe, it, expect } from 'vitest'
import { canTransitionPhase, assertPhaseTransition } from './phase'
import { InvalidTransitionError } from '@/lib/server/errors'

describe('phase state transitions', () => {
  it('pending → in_progress', () => {
    expect(canTransitionPhase('pending', 'in_progress')).toBe(true)
  })
  it('in_progress → complete', () => {
    expect(canTransitionPhase('in_progress', 'complete')).toBe(true)
  })
  it('rejects skipping pending → complete', () => {
    expect(canTransitionPhase('pending', 'complete')).toBe(false)
  })
  it('rejects complete → pending', () => {
    expect(canTransitionPhase('complete', 'pending')).toBe(false)
  })
  it('rejects same-state', () => {
    expect(canTransitionPhase('pending', 'pending')).toBe(false)
  })
  it('throws on illegal', () => {
    expect(() => assertPhaseTransition('pending', 'complete')).toThrow(InvalidTransitionError)
  })
})

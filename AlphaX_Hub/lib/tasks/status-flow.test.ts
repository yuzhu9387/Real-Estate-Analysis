import { describe, it, expect } from 'vitest'
import { computeVisibleStages, activeStage } from './status-flow'

describe('computeVisibleStages', () => {
  it('with reviewer → 3 stages', () => {
    expect(computeVisibleStages(true)).toEqual(['start', 'submit_review', 'complete'])
  })

  it('without reviewer → 2 stages (no submit_review)', () => {
    expect(computeVisibleStages(false)).toEqual(['start', 'complete'])
  })
})

describe('activeStage', () => {
  it('not_started → start (both)', () => {
    expect(activeStage('not_started', true)).toBe('start')
    expect(activeStage('not_started', false)).toBe('start')
  })

  it('started → submit_review (with reviewer) / complete (without)', () => {
    expect(activeStage('started', true)).toBe('submit_review')
    expect(activeStage('started', false)).toBe('complete')
  })

  it('pending_review → submit_review (with reviewer) / null (without)', () => {
    expect(activeStage('pending_review', true)).toBe('submit_review')
    expect(activeStage('pending_review', false)).toBeNull()
  })

  it('approved → complete (with reviewer) / null (without)', () => {
    expect(activeStage('approved', true)).toBe('complete')
    expect(activeStage('approved', false)).toBeNull()
  })

  it('complete → complete (both)', () => {
    expect(activeStage('complete', true)).toBe('complete')
    expect(activeStage('complete', false)).toBe('complete')
  })

  it('wont_do → wont_do (both)', () => {
    expect(activeStage('wont_do', true)).toBe('wont_do')
    expect(activeStage('wont_do', false)).toBe('wont_do')
  })
})

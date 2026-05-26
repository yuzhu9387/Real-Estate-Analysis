import { describe, it, expect } from 'vitest'
import { deriveCurrentState } from './current-state'

describe('deriveCurrentState', () => {
  it('Sold trumps everything when sold=true', () => {
    expect(deriveCurrentState({
      status: 'in_progress', sold: true, listingDate: '2026-04-01',
      phases: [{ name: 'Permitting', status: 'complete', sortOrder: 1 }],
    })).toBe('Sold')
  })

  it('Listed when listing_date set but not sold', () => {
    expect(deriveCurrentState({
      status: 'in_progress', sold: false, listingDate: '2026-05-01',
      phases: [{ name: 'Sale', status: 'in_progress', sortOrder: 3 }],
    })).toBe('Listed')
  })

  it('Presale Phase 3 / 2 / 1', () => {
    expect(deriveCurrentState({
      status: 'in_progress', sold: false,
      presalePhase3Date: '2026-04-01',
      phases: [{ name: 'Sale', status: 'in_progress', sortOrder: 3 }],
    })).toBe('Presale Phase 3')
    expect(deriveCurrentState({
      status: 'in_progress', sold: false,
      presalePhase2Date: '2026-04-01',
      phases: [{ name: 'Sale', status: 'in_progress', sortOrder: 3 }],
    })).toBe('Presale Phase 2')
    expect(deriveCurrentState({
      status: 'in_progress', sold: false,
      presalePhase1Date: '2026-04-01',
      phases: [{ name: 'Sale', status: 'in_progress', sortOrder: 3 }],
    })).toBe('Presale Phase 1')
  })

  it('Under Construction when Construction phase in_progress', () => {
    expect(deriveCurrentState({
      status: 'in_progress', sold: false,
      phases: [
        { name: 'Permitting', status: 'complete', sortOrder: 1 },
        { name: 'Construction', status: 'in_progress', sortOrder: 2 },
      ],
    })).toBe('Under Construction')
  })

  it('Under Permitting when only Permitting in_progress', () => {
    expect(deriveCurrentState({
      status: 'in_progress', sold: false,
      phases: [{ name: 'Permitting', status: 'in_progress', sortOrder: 1 }],
    })).toBe('Under Permitting')
  })

  it('Draft / Complete / Archived from project.status', () => {
    expect(deriveCurrentState({ status: 'draft', sold: false, phases: [] })).toBe('Draft')
    expect(deriveCurrentState({ status: 'complete', sold: false, phases: [] })).toBe('Complete')
    expect(deriveCurrentState({ status: 'archived', sold: false, phases: [] })).toBe('Archived')
  })
})

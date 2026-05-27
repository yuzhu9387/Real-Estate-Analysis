import { describe, it, expect } from 'vitest'
import { validateWizard, type WizardState } from './validate'

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    name: 'Project 1',
    brand: 'al_homes',
    city: 'Newton',
    state: 'MA',
    targetExitYear: 2026,
    targetExitQuarter: 3,
    assignments: [{
      id: 'a1', phase: 'Permitting', templateId: 'tpl-1',
      templateName: 'Permits', sortOrder: 0,
    }],
    ...overrides,
  }
}

describe('validateWizard', () => {
  it('passes when everything is filled', () => {
    expect(validateWizard(makeState())).toBe(null)
  })

  it('fails when name is empty', () => {
    expect(validateWizard(makeState({ name: '' }))).toBe('name')
    expect(validateWizard(makeState({ name: '   ' }))).toBe('name')
  })

  it('fails when city is empty', () => {
    expect(validateWizard(makeState({ city: '' }))).toBe('city')
  })

  it('fails when state is empty', () => {
    expect(validateWizard(makeState({ state: '' }))).toBe('state')
  })

  it('fails when target quarter is out of range', () => {
    expect(validateWizard(makeState({ targetExitQuarter: 5 as unknown as 1 }))).toBe('exit_quarter_format')
    expect(validateWizard(makeState({ targetExitQuarter: 0 as unknown as 1 }))).toBe('exit_quarter_format')
  })

  it('fails when target year is unreasonable', () => {
    expect(validateWizard(makeState({ targetExitYear: 1999 }))).toBe('exit_quarter_format')
    expect(validateWizard(makeState({ targetExitYear: 3000 }))).toBe('exit_quarter_format')
  })

  it('fails when Permitting has zero assignments', () => {
    expect(validateWizard(makeState({ assignments: [] }))).toBe('permitting_empty')
    expect(validateWizard(makeState({
      assignments: [{ id: 'a1', phase: 'Construction', templateId: 't1', templateName: 'X', sortOrder: 0 }],
    }))).toBe('permitting_empty')
  })

  it('passes with extra optional Construction/Sale assignments', () => {
    expect(validateWizard(makeState({
      assignments: [
        { id: 'a1', phase: 'Permitting', templateId: 't1', templateName: 'A', sortOrder: 0 },
        { id: 'a2', phase: 'Construction', templateId: 't2', templateName: 'B', sortOrder: 0 },
        { id: 'a3', phase: 'Sale', templateId: 't3', templateName: 'C', sortOrder: 0 },
      ],
    }))).toBe(null)
  })
})

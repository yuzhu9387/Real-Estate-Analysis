import { describe, it, expect } from 'vitest'
import { evaluateAtRisk } from './at-risk'

const today = new Date('2026-06-01')

describe('evaluateAtRisk', () => {
  it('not at risk when no targets set', () => {
    const out = evaluateAtRisk({}, today)
    expect(out.atRisk).toBe(false)
    expect(out.severity).toBe(null)
  })

  it('permit overdue when target_permit_date is in the past and actual_permit_date is null', () => {
    const out = evaluateAtRisk({ targetPermitDate: '2026-05-01', actualPermitDate: null }, today)
    expect(out.atRisk).toBe(true)
    expect(out.severity).toBe('permit_overdue')
    expect(out.daysBehind).toBe(31)
  })

  it('not overdue when actual_permit_date is set, even if late', () => {
    const out = evaluateAtRisk({
      targetPermitDate: '2026-05-01', actualPermitDate: '2026-05-15',
    }, today)
    expect(out.atRisk).toBe(false)
  })

  it('construction overdue when target_construction_end_date is past and actual null', () => {
    const out = evaluateAtRisk({
      targetConstructionEndDate: '2026-04-01', actualConstructionEndDate: null,
    }, today)
    expect(out.atRisk).toBe(true)
    expect(out.severity).toBe('construction_overdue')
  })

  it('exit-quarter overdue when current date past end-of-quarter and sold is false', () => {
    const out = evaluateAtRisk({ targetExitQuarter: '2026-Q1', sold: false }, new Date('2026-06-15'))
    expect(out.atRisk).toBe(true)
    expect(out.severity).toBe('exit_overdue')
  })

  it('exit-quarter NOT overdue when sold is true', () => {
    const out = evaluateAtRisk({ targetExitQuarter: '2026-Q1', sold: true }, new Date('2026-06-15'))
    expect(out.atRisk).toBe(false)
  })

  it('picks highest severity when multiple triggers fire', () => {
    const out = evaluateAtRisk({
      targetPermitDate: '2026-04-01', actualPermitDate: null,
      targetConstructionEndDate: '2026-05-01', actualConstructionEndDate: null,
      targetExitQuarter: '2026-Q1', sold: false,
    }, today)
    expect(out.atRisk).toBe(true)
    expect(out.severity).toBe('exit_overdue')
  })
})

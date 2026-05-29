import { describe, it, expect } from 'vitest'
import { cascadeProjectSchedule } from './project-targets'

describe('cascadeProjectSchedule', () => {
  it('returns nulls when start date is missing', () => {
    const out = cascadeProjectSchedule({
      targetStartDate: null,
      targetPermittingDurationDays: 30,
      targetConstructionDurationDays: 60,
      targetSalesDurationDays: 90,
    })
    expect(out.targetPermitDate).toBeNull()
    expect(out.targetConstructionEndDate).toBeNull()
    expect(out.targetExitDate).toBeNull()
    // total duration can be computed without a start date.
    expect(out.targetProjectDurationDays).toBe(180)
  })

  it('cascades start + durations through all three milestones', () => {
    const out = cascadeProjectSchedule({
      targetStartDate: '2026-01-01',
      targetPermittingDurationDays: 30,
      targetConstructionDurationDays: 60,
      targetSalesDurationDays: 90,
    })
    expect(out.targetPermitDate).toBe('2026-01-31')           // +30
    expect(out.targetConstructionEndDate).toBe('2026-04-01')   // +90 from start
    expect(out.targetExitDate).toBe('2026-06-30')              // +180 from start
    expect(out.targetProjectDurationDays).toBe(180)
  })

  it('stops the cascade when a downstream duration is missing', () => {
    const out = cascadeProjectSchedule({
      targetStartDate: '2026-01-01',
      targetPermittingDurationDays: 30,
      targetConstructionDurationDays: null,
      targetSalesDurationDays: 90,
    })
    expect(out.targetPermitDate).toBe('2026-01-31')
    expect(out.targetConstructionEndDate).toBeNull()
    expect(out.targetExitDate).toBeNull()
    expect(out.targetProjectDurationDays).toBeNull()
  })

  it('rejects non-integer or negative durations (returns null for that value)', () => {
    const out = cascadeProjectSchedule({
      targetStartDate: '2026-01-01',
      targetPermittingDurationDays: -5,
      targetConstructionDurationDays: 60.5,
      targetSalesDurationDays: 90,
    })
    expect(out.targetPermittingDurationDays).toBeNull()
    expect(out.targetConstructionDurationDays).toBeNull()
    expect(out.targetPermitDate).toBeNull()
  })

  it('handles month boundary correctly (Feb in a non-leap year)', () => {
    const out = cascadeProjectSchedule({
      targetStartDate: '2026-02-01',
      targetPermittingDurationDays: 28,
      targetConstructionDurationDays: 0,
      targetSalesDurationDays: 0,
    })
    expect(out.targetPermitDate).toBe('2026-03-01')
  })
})

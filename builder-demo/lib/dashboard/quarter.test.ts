import { describe, it, expect } from 'vitest'
import { compareQuarters, parseQuarter, formatQuarterLabel } from './quarter'

describe('quarter helpers', () => {
  it('parseQuarter returns { year, q } for valid strings', () => {
    expect(parseQuarter('2026-Q3')).toEqual({ year: 2026, q: 3 })
    expect(parseQuarter('2027-Q1')).toEqual({ year: 2027, q: 1 })
    expect(parseQuarter('bogus')).toBe(null)
    expect(parseQuarter(null)).toBe(null)
    expect(parseQuarter('2026-Q5')).toBe(null)
  })

  it('compareQuarters orders ascending by year then quarter', () => {
    expect(compareQuarters('2026-Q1', '2026-Q3')).toBeLessThan(0)
    expect(compareQuarters('2027-Q1', '2026-Q4')).toBeGreaterThan(0)
    expect(compareQuarters('2026-Q3', '2026-Q3')).toBe(0)
    expect(compareQuarters(null, '2026-Q3')).toBeGreaterThan(0)
    expect(compareQuarters('2026-Q3', null)).toBeLessThan(0)
    expect(compareQuarters(null, null)).toBe(0)
  })

  it('formatQuarterLabel handles unknown', () => {
    expect(formatQuarterLabel('2026-Q3')).toBe('2026 Q3')
    expect(formatQuarterLabel(null)).toBe('Unscheduled')
    expect(formatQuarterLabel('garbage')).toBe('Unscheduled')
  })
})

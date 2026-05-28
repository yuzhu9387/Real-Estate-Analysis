import { describe, it, expect } from 'vitest'
import { computeTotals } from './compute-totals'

describe('computeTotals', () => {
  it('zero tasks → all zeros', () => {
    expect(computeTotals([])).toEqual({ totalStartDay: 0, totalEndDay: 0, totalDurationDays: 0 })
  })

  it('single task → start/end/duration mirror the task', () => {
    expect(computeTotals([{ startDay: 1, endDay: 6 }])).toEqual({
      totalStartDay: 1, totalEndDay: 6, totalDurationDays: 5,
    })
  })

  it('multiple tasks → min start, max end, max-min duration', () => {
    expect(computeTotals([
      { startDay: 1, endDay: 6 },
      { startDay: 6, endDay: 11 },
      { startDay: 11, endDay: 14 },
    ])).toEqual({ totalStartDay: 1, totalEndDay: 14, totalDurationDays: 13 })
  })

  it('overlapping tasks → still min/max', () => {
    expect(computeTotals([
      { startDay: 1,  endDay: 10 },
      { startDay: 3,  endDay: 7  },
      { startDay: 5,  endDay: 12 },
    ])).toEqual({ totalStartDay: 1, totalEndDay: 12, totalDurationDays: 11 })
  })

  it('zero-duration milestone task → counted in min/max', () => {
    expect(computeTotals([
      { startDay: 1, endDay: 5 },
      { startDay: 5, endDay: 5 },
    ])).toEqual({ totalStartDay: 1, totalEndDay: 5, totalDurationDays: 4 })
  })
})

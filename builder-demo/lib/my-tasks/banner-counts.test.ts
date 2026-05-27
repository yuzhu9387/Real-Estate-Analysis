import { describe, it, expect } from 'vitest'
import { computeBannerCounts } from './banner-counts'

describe('computeBannerCounts', () => {
  it('empty input → all zeros', () => {
    expect(computeBannerCounts([], 0)).toEqual({ overdue: 0, blocked: 0, ready: 0 })
  })

  it('overdue = past planned_end_day and not blocked', () => {
    expect(computeBannerCounts([
      { status: 'started', isBlocked: false, plannedEndDay: 5 },
    ], 10)).toEqual({ overdue: 1, blocked: 0, ready: 0 })
  })

  it('blocked counts in blocked bucket only (not overdue)', () => {
    expect(computeBannerCounts([
      { status: 'not_started', isBlocked: true, plannedEndDay: 5 },
    ], 10)).toEqual({ overdue: 0, blocked: 1, ready: 0 })
  })

  it('ready = not blocked and not overdue', () => {
    expect(computeBannerCounts([
      { status: 'not_started', isBlocked: false, plannedEndDay: 20 },
      { status: 'started', isBlocked: false, plannedEndDay: null },
    ], 10)).toEqual({ overdue: 0, blocked: 0, ready: 2 })
  })

  it('mixed', () => {
    expect(computeBannerCounts([
      { status: 'started', isBlocked: false, plannedEndDay: 3 },
      { status: 'not_started', isBlocked: true, plannedEndDay: 3 },
      { status: 'not_started', isBlocked: false, plannedEndDay: 15 },
      { status: 'started', isBlocked: false, plannedEndDay: null },
    ], 10)).toEqual({ overdue: 1, blocked: 1, ready: 2 })
  })
})

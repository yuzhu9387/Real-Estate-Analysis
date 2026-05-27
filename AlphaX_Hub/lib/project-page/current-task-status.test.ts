import { describe, it, expect } from 'vitest'
import { currentTaskStatus } from './current-task-status'

describe('currentTaskStatus', () => {
  it('on track when no problems', () => {
    expect(currentTaskStatus({ status: 'not_started', isBlocked: false, plannedEndDay: 10 }, 5)).toEqual({
      level: 'on_track', daysBehind: 0,
    })
  })

  it('at risk when blocked (deps incomplete)', () => {
    expect(currentTaskStatus({ status: 'not_started', isBlocked: true, plannedEndDay: 10 }, 5)).toEqual({
      level: 'at_risk', daysBehind: 0,
    })
  })

  it('delay when past planned_end_day and not terminal', () => {
    expect(currentTaskStatus({ status: 'started', isBlocked: false, plannedEndDay: 5 }, 10)).toEqual({
      level: 'delay', daysBehind: 5,
    })
  })

  it('complete tasks are always on_track regardless of planned dates', () => {
    expect(currentTaskStatus({ status: 'complete', isBlocked: false, plannedEndDay: 5 }, 10)).toEqual({
      level: 'on_track', daysBehind: 0,
    })
  })

  it('wont_do tasks are always on_track', () => {
    expect(currentTaskStatus({ status: 'wont_do', isBlocked: true, plannedEndDay: 5 }, 10)).toEqual({
      level: 'on_track', daysBehind: 0,
    })
  })

  it('handles null planned_end_day (treat as no delay)', () => {
    expect(currentTaskStatus({ status: 'started', isBlocked: false, plannedEndDay: null }, 10)).toEqual({
      level: 'on_track', daysBehind: 0,
    })
  })
})

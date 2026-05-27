import { describe, it, expect } from 'vitest'
import { rankMyOpenTasks, type TaskRanked } from './ranking'

function makeTask(p: Partial<TaskRanked>): TaskRanked {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    isBlocked: false,
    plannedEndDay: null,
    isOnCriticalPath: false,
    priority: 'normal',
    ...p,
  }
}

describe('rankMyOpenTasks', () => {
  it('empty input → empty output', () => {
    expect(rankMyOpenTasks([], 0)).toEqual([])
  })

  it('unblocked tasks before blocked', () => {
    const a = makeTask({ id: 'a', isBlocked: true })
    const b = makeTask({ id: 'b', isBlocked: false })
    expect(rankMyOpenTasks([a, b], 0).map(t => t.id)).toEqual(['b', 'a'])
  })

  it('among unblocked, earlier planned_end_day first', () => {
    const tasks = [
      makeTask({ id: 'late', plannedEndDay: 30 }),
      makeTask({ id: 'mid', plannedEndDay: 10 }),
      makeTask({ id: 'early', plannedEndDay: 5 }),
    ]
    expect(rankMyOpenTasks(tasks, 0).map(t => t.id)).toEqual(['early', 'mid', 'late'])
  })

  it('null planned_end_day sorts last among unblocked', () => {
    const tasks = [
      makeTask({ id: 'nil', plannedEndDay: null }),
      makeTask({ id: 'soon', plannedEndDay: 5 }),
    ]
    expect(rankMyOpenTasks(tasks, 0).map(t => t.id)).toEqual(['soon', 'nil'])
  })

  it('among same due-day, critical-path first', () => {
    const tasks = [
      makeTask({ id: 'normal', plannedEndDay: 10, isOnCriticalPath: false }),
      makeTask({ id: 'critical', plannedEndDay: 10, isOnCriticalPath: true }),
    ]
    expect(rankMyOpenTasks(tasks, 0).map(t => t.id)).toEqual(['critical', 'normal'])
  })

  it('among same urgency + critical, HIGH priority first', () => {
    const tasks = [
      makeTask({ id: 'lo', plannedEndDay: 10, isOnCriticalPath: true, priority: 'low' }),
      makeTask({ id: 'hi', plannedEndDay: 10, isOnCriticalPath: true, priority: 'high' }),
      makeTask({ id: 'mid', plannedEndDay: 10, isOnCriticalPath: true, priority: 'normal' }),
    ]
    expect(rankMyOpenTasks(tasks, 0).map(t => t.id)).toEqual(['hi', 'mid', 'lo'])
  })

  it('worked example from spec', () => {
    const tasks = [
      makeTask({ id: 'A', isBlocked: false, plannedEndDay: 45, isOnCriticalPath: true,  priority: 'normal' }),
      makeTask({ id: 'B', isBlocked: false, plannedEndDay: 50, isOnCriticalPath: true,  priority: 'high' }),
      makeTask({ id: 'C', isBlocked: false, plannedEndDay: 50, isOnCriticalPath: false, priority: 'high' }),
      makeTask({ id: 'D', isBlocked: false, plannedEndDay: null, isOnCriticalPath: false, priority: 'high' }),
      makeTask({ id: 'E', isBlocked: true,  plannedEndDay: 40, isOnCriticalPath: true,  priority: 'high' }),
    ]
    expect(rankMyOpenTasks(tasks, 47).map(t => t.id)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
})

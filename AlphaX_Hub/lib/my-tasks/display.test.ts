import { describe, it, expect } from 'vitest'
import { priorityFocusScore } from './display'

const baseTask = {
  status: 'started' as const,
  priority: 'normal' as const,
  isBlocked: false,
  plannedEndDay: 10,
  isOnCriticalPath: false,
}

describe('priorityFocusScore', () => {
  it('returns -1 for completed tasks', () => {
    expect(priorityFocusScore({ ...baseTask, status: 'complete' }, 5)).toBe(-1)
  })

  it('returns -1 for wont_do tasks', () => {
    expect(priorityFocusScore({ ...baseTask, status: 'wont_do' }, 5)).toBe(-1)
  })

  it('returns -1 for blocked tasks — they must never appear in Priority Focus', () => {
    // A massively overdue, high-priority, on-critical-path task would normally score very high.
    // Once it's blocked the score must drop to -1 so it never ranks into the focus strip.
    const wouldNormallyTopRank = {
      ...baseTask,
      isBlocked: true,
      priority: 'high' as const,
      plannedEndDay: -30,     // 30 days overdue
      isOnCriticalPath: true,
    }
    expect(priorityFocusScore(wouldNormallyTopRank, 0)).toBe(-1)
  })

  it('overdue beats due-soon beats high-priority alone', () => {
    const overdue = priorityFocusScore({ ...baseTask, plannedEndDay: 0 }, 10) // 10 days overdue
    const dueToday = priorityFocusScore({ ...baseTask, plannedEndDay: 10 }, 10)
    const dueSoon = priorityFocusScore({ ...baseTask, plannedEndDay: 15 }, 10) // due in 5d
    const highPrioFar = priorityFocusScore(
      { ...baseTask, priority: 'high', plannedEndDay: 100 },
      10,
    )
    expect(overdue).toBeGreaterThan(dueToday)
    expect(dueToday).toBeGreaterThan(dueSoon)
    expect(dueSoon).toBeGreaterThan(highPrioFar)
  })

  it('a blocked overdue task scores below an unblocked future task', () => {
    const blockedOverdue = priorityFocusScore(
      { ...baseTask, isBlocked: true, plannedEndDay: -5 },
      0,
    )
    const futureUnblocked = priorityFocusScore(
      { ...baseTask, isBlocked: false, plannedEndDay: 90 },
      0,
    )
    // The whole point: blocked tasks rank dead last regardless of urgency.
    expect(blockedOverdue).toBeLessThan(futureUnblocked)
  })
})

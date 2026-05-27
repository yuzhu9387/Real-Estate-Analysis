import { describe, it, expect } from 'vitest'
import { buildDigestMessage, shouldSendDigest } from './digest-payload'

describe('shouldSendDigest', () => {
  it('returns false when all counts are 0', () => {
    expect(shouldSendDigest({ overdueCount: 0, dueThisWeekCount: 0, pendingMyReviewCount: 0 })).toBe(false)
  })
  it('returns true when any count > 0', () => {
    expect(shouldSendDigest({ overdueCount: 1, dueThisWeekCount: 0, pendingMyReviewCount: 0 })).toBe(true)
    expect(shouldSendDigest({ overdueCount: 0, dueThisWeekCount: 3, pendingMyReviewCount: 0 })).toBe(true)
    expect(shouldSendDigest({ overdueCount: 0, dueThisWeekCount: 0, pendingMyReviewCount: 1 })).toBe(true)
  })
})

describe('buildDigestMessage', () => {
  it('includes all three counts and the link', () => {
    const out = buildDigestMessage({
      overdueCount: 3, dueThisWeekCount: 5, pendingMyReviewCount: 2,
      myTasksUrl: 'https://buildflow.example.com/my-tasks',
    })
    expect(out).toContain('Overdue: 3')
    expect(out).toContain('Due this week: 5')
    expect(out).toContain('Pending your review: 2')
    expect(out).toContain('https://buildflow.example.com/my-tasks')
  })
})

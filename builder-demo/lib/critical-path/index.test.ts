import { describe, it, expect } from 'vitest'
import { recomputeSchedule } from './index'

describe('recomputeSchedule — linear chain', () => {
  it('computes earliest start/end for a → b → c', () => {
    const out = recomputeSchedule({
      tasks: [
        { id: 'a', durationDays: 2, status: 'not_started' },
        { id: 'b', durationDays: 3, status: 'not_started' },
        { id: 'c', durationDays: 4, status: 'not_started' },
      ],
      deps: [
        { fromTaskId: 'a', toTaskId: 'b', lagDays: 0 },
        { fromTaskId: 'b', toTaskId: 'c', lagDays: 0 },
      ],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['a']).toMatchObject({ earliestStartDay: 0, earliestEndDay: 2 })
    expect(map['b']).toMatchObject({ earliestStartDay: 2, earliestEndDay: 5 })
    expect(map['c']).toMatchObject({ earliestStartDay: 5, earliestEndDay: 9 })
  })
})

describe('recomputeSchedule — parallel branches and diamond', () => {
  it('parallel branches: a → {b, c} → d', () => {
    const out = recomputeSchedule({
      tasks: [
        { id: 'a', durationDays: 2, status: 'not_started' },
        { id: 'b', durationDays: 3, status: 'not_started' },
        { id: 'c', durationDays: 5, status: 'not_started' },
        { id: 'd', durationDays: 1, status: 'not_started' },
      ],
      deps: [
        { fromTaskId: 'a', toTaskId: 'b', lagDays: 0 },
        { fromTaskId: 'a', toTaskId: 'c', lagDays: 0 },
        { fromTaskId: 'b', toTaskId: 'd', lagDays: 0 },
        { fromTaskId: 'c', toTaskId: 'd', lagDays: 0 },
      ],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['d'].earliestStartDay).toBe(7)
    expect(map['c'].isOnCriticalPath).toBe(true)
    expect(map['b'].isOnCriticalPath).toBe(false)
    expect(map['b'].slackDays).toBe(2)
  })

  it('respects lag days', () => {
    const out = recomputeSchedule({
      tasks: [
        { id: 'a', durationDays: 2, status: 'not_started' },
        { id: 'b', durationDays: 1, status: 'not_started' },
      ],
      deps: [{ fromTaskId: 'a', toTaskId: 'b', lagDays: 3 }],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['b'].earliestStartDay).toBe(5)
  })
})

describe('recomputeSchedule — wont_do excluded', () => {
  it('treats wont_do task as if removed from graph', () => {
    const out = recomputeSchedule({
      tasks: [
        { id: 'a', durationDays: 2, status: 'not_started' },
        { id: 'b', durationDays: 5, status: 'wont_do' },
        { id: 'c', durationDays: 1, status: 'not_started' },
      ],
      deps: [
        { fromTaskId: 'a', toTaskId: 'b', lagDays: 0 },
        { fromTaskId: 'b', toTaskId: 'c', lagDays: 0 },
      ],
    })
    expect(out.map(o => o.taskId).sort()).toEqual(['a','c'])
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['c'].earliestStartDay).toBe(0)
  })
})

describe('recomputeSchedule — cycle detection', () => {
  it('throws on circular deps', () => {
    expect(() => recomputeSchedule({
      tasks: [
        { id: 'a', durationDays: 1, status: 'not_started' },
        { id: 'b', durationDays: 1, status: 'not_started' },
      ],
      deps: [
        { fromTaskId: 'a', toTaskId: 'b', lagDays: 0 },
        { fromTaskId: 'b', toTaskId: 'a', lagDays: 0 },
      ],
    })).toThrow(/cycle/i)
  })
})

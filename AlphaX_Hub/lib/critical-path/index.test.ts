import { describe, it, expect } from 'vitest'
import { recomputeSchedule } from './index'

describe('recomputeSchedule — linear chain', () => {
  it('computes earliest start/end for a → b → c', () => {
    const out = recomputeSchedule({
      tasks: [
        { id: 'a', startDay: 0, endDay: 2, status: 'not_started' },
        { id: 'b', startDay: 2, endDay: 5, status: 'not_started' },
        { id: 'c', startDay: 5, endDay: 9, status: 'not_started' },
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
    // a[0,2], b[2,5] (dur=3), c[2,7] (dur=5), d[7,8] (dur=1)
    // projectEnd=8; backward pass:
    //   d: latestEnd=8, latestStart=7 (dur=1)
    //   b: successors=[d], le=latestStart_d - lag0 = 7, latestStart=7-3=4, slack=4-2=2
    //   c: successors=[d], le=7, latestStart=7-5=2, slack=2-2=0 (critical)
    //   a: successors=[b,c], le=min(latestStart_b-0, latestStart_c-0)=min(4,2)=2, latestStart=0, slack=0-0=0
    const out = recomputeSchedule({
      tasks: [
        { id: 'a', startDay: 0, endDay: 2, status: 'not_started' },
        { id: 'b', startDay: 2, endDay: 5, status: 'not_started' },
        { id: 'c', startDay: 2, endDay: 7, status: 'not_started' },
        { id: 'd', startDay: 7, endDay: 8, status: 'not_started' },
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
    // a[0,2], lag=3, so b logically starts at 5; scheduler reads startDay directly
    const out = recomputeSchedule({
      tasks: [
        { id: 'a', startDay: 0, endDay: 2, status: 'not_started' },
        { id: 'b', startDay: 5, endDay: 6, status: 'not_started' },
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
        { id: 'a', startDay: 0, endDay: 2, status: 'not_started' },
        { id: 'b', startDay: 2, endDay: 7, status: 'wont_do' },
        { id: 'c', startDay: 0, endDay: 1, status: 'not_started' },
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
        { id: 'a', startDay: 0, endDay: 1, status: 'not_started' },
        { id: 'b', startDay: 1, endDay: 2, status: 'not_started' },
      ],
      deps: [
        { fromTaskId: 'a', toTaskId: 'b', lagDays: 0 },
        { fromTaskId: 'b', toTaskId: 'a', lagDays: 0 },
      ],
    })).toThrow(/cycle/i)
  })
})

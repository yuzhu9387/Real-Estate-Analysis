import { describe, it, expect } from 'vitest'
import { computeBlocked } from './blocked'

describe('computeBlocked', () => {
  it('not blocked when no deps', () => {
    const out = computeBlocked({
      tasks: [{ id: 'a', status: 'not_started' }],
      deps: [],
    })
    expect(out).toEqual([{ taskId: 'a', isBlocked: false }])
  })

  it('blocked when upstream is not_started', () => {
    const out = computeBlocked({
      tasks: [
        { id: 'a', status: 'not_started' },
        { id: 'b', status: 'not_started' },
      ],
      deps: [{ fromTaskId: 'a', toTaskId: 'b' }],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['a'].isBlocked).toBe(false)
    expect(map['b'].isBlocked).toBe(true)
  })

  it('unblocked when upstream is complete', () => {
    const out = computeBlocked({
      tasks: [
        { id: 'a', status: 'complete' },
        { id: 'b', status: 'not_started' },
      ],
      deps: [{ fromTaskId: 'a', toTaskId: 'b' }],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['b'].isBlocked).toBe(false)
  })

  it('wont_do satisfies downstream just like complete', () => {
    const out = computeBlocked({
      tasks: [
        { id: 'a', status: 'wont_do' },
        { id: 'b', status: 'not_started' },
      ],
      deps: [{ fromTaskId: 'a', toTaskId: 'b' }],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['b'].isBlocked).toBe(false)
  })

  it('blocked if any upstream is not terminal', () => {
    const out = computeBlocked({
      tasks: [
        { id: 'a', status: 'complete' },
        { id: 'b', status: 'started' },
        { id: 'c', status: 'not_started' },
      ],
      deps: [
        { fromTaskId: 'a', toTaskId: 'c' },
        { fromTaskId: 'b', toTaskId: 'c' },
      ],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['c'].isBlocked).toBe(true)
  })
})

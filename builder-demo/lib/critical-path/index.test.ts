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

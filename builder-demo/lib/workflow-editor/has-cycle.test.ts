import { describe, it, expect } from 'vitest'
import { hasCycle } from './has-cycle'

describe('hasCycle', () => {
  it('empty input → false', () => {
    expect(hasCycle({ tasks: [], deps: [] })).toBe(false)
  })

  it('linear chain → false', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      deps: [{ fromId: 'a', toId: 'b' }, { fromId: 'b', toId: 'c' }],
    })).toBe(false)
  })

  it('diamond → false', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      deps: [
        { fromId: 'a', toId: 'b' }, { fromId: 'a', toId: 'c' },
        { fromId: 'b', toId: 'd' }, { fromId: 'c', toId: 'd' },
      ],
    })).toBe(false)
  })

  it('self-edge → true', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }],
      deps: [{ fromId: 'a', toId: 'a' }],
    })).toBe(true)
  })

  it('2-cycle → true', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }, { id: 'b' }],
      deps: [{ fromId: 'a', toId: 'b' }, { fromId: 'b', toId: 'a' }],
    })).toBe(true)
  })

  it('3-cycle → true', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      deps: [
        { fromId: 'a', toId: 'b' },
        { fromId: 'b', toId: 'c' },
        { fromId: 'c', toId: 'a' },
      ],
    })).toBe(true)
  })

  it('cycle in disconnected subgraph → true', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      deps: [
        { fromId: 'a', toId: 'b' },
        { fromId: 'c', toId: 'd' },
        { fromId: 'd', toId: 'c' },
      ],
    })).toBe(true)
  })

  it('ignores deps that reference unknown tasks', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }],
      deps: [{ fromId: 'a', toId: 'ghost' }],
    })).toBe(false)
  })
})

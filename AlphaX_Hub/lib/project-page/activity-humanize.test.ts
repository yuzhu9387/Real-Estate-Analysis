import { describe, it, expect } from 'vitest'
import { humanizeActivity } from './activity-humanize'

const actor = { id: 'u1', name: 'Mark Chen' }
const taskById = new Map([['t1', 'Apply building permit']])

describe('humanizeActivity', () => {
  it('phase.kicked_off', () => {
    expect(humanizeActivity({
      type: 'phase.kicked_off',
      payload: { phaseName: 'Permitting' },
      actor, taskById,
    }).text).toBe('Mark Chen kicked off the Permitting phase')
  })

  it('phase.marked_complete', () => {
    expect(humanizeActivity({
      type: 'phase.marked_complete',
      payload: { phaseName: 'Construction' },
      actor, taskById,
    }).text).toBe('Mark Chen marked the Construction phase complete')
  })

  it('task.status_changed', () => {
    const out = humanizeActivity({
      type: 'task.status_changed',
      payload: { taskId: 't1', from: 'started', to: 'pending_review' },
      actor, taskById,
    })
    expect(out.text).toContain('Apply building permit')
    expect(out.text).toContain('started')
    expect(out.text).toContain('pending_review')
    expect(out.taskId).toBe('t1')
  })

  it('task.added_unplanned uses payload name when task is freshly added', () => {
    expect(humanizeActivity({
      type: 'task.added_unplanned',
      payload: { taskId: 'tX', name: 'Schedule inspection' },
      actor, taskById,
    }).text).toContain('Schedule inspection')
  })

  it('unknown type falls back gracefully', () => {
    const out = humanizeActivity({
      type: 'something.weird',
      payload: { foo: 'bar' },
      actor, taskById,
    })
    expect(out.text).toContain('Mark Chen')
    expect(out.text).toContain('something.weird')
  })
})

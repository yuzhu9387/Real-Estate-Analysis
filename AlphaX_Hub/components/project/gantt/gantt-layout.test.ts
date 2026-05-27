import { describe, it, expect } from 'vitest'
import { computeGanttLayout } from './gantt-layout'

describe('computeGanttLayout', () => {
  it('handles week zoom: 1 day = 14px', () => {
    const layout = computeGanttLayout({
      zoom: 'week',
      minDay: 0, maxDay: 30,
      tasks: [{ id: 't1', start: 0, end: 5 }],
    })
    expect(layout.dayWidth).toBe(14)
    expect(layout.totalWidth).toBe(30 * 14)
    expect(layout.taskX[0]).toEqual({ id: 't1', x: 0, width: 70 })
  })

  it('handles month zoom: 1 day = 6px', () => {
    const layout = computeGanttLayout({
      zoom: 'month', minDay: 0, maxDay: 90,
      tasks: [{ id: 't1', start: 30, end: 45 }],
    })
    expect(layout.dayWidth).toBe(6)
    expect(layout.taskX[0]).toEqual({ id: 't1', x: 180, width: 90 })
  })

  it('handles quarter zoom: 1 day = 2px', () => {
    const layout = computeGanttLayout({
      zoom: 'quarter', minDay: 0, maxDay: 180,
      tasks: [{ id: 't1', start: 90, end: 100 }],
    })
    expect(layout.dayWidth).toBe(2)
    expect(layout.taskX[0]).toEqual({ id: 't1', x: 180, width: 20 })
  })

  it('uses minimum width when task has 0 duration', () => {
    const layout = computeGanttLayout({
      zoom: 'week', minDay: 0, maxDay: 10,
      tasks: [{ id: 't1', start: 5, end: 5 }],
    })
    expect(layout.taskX[0].width).toBeGreaterThanOrEqual(4)
  })
})

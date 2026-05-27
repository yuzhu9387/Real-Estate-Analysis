export type Zoom = 'week' | 'month' | 'quarter'

const DAY_WIDTH: Record<Zoom, number> = { week: 14, month: 6, quarter: 2 }
const MIN_BAR_WIDTH = 4

export type GanttLayoutInput = {
  zoom: Zoom
  minDay: number
  maxDay: number
  tasks: Array<{ id: string; start: number; end: number }>
}

export type GanttLayout = {
  dayWidth: number
  totalWidth: number
  taskX: Array<{ id: string; x: number; width: number }>
}

export function computeGanttLayout(input: GanttLayoutInput): GanttLayout {
  const dayWidth = DAY_WIDTH[input.zoom]
  const totalWidth = (input.maxDay - input.minDay) * dayWidth
  const taskX = input.tasks.map(t => ({
    id: t.id,
    x: (t.start - input.minDay) * dayWidth,
    width: Math.max(MIN_BAR_WIDTH, (t.end - t.start) * dayWidth),
  }))
  return { dayWidth, totalWidth, taskX }
}

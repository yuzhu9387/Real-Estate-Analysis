export type TaskDates = { startDay: number; endDay: number }
export type Totals = {
  totalStartDay: number
  totalEndDay: number
  totalDurationDays: number
}

export function computeTotals(tasks: TaskDates[]): Totals {
  if (tasks.length === 0) {
    return { totalStartDay: 0, totalEndDay: 0, totalDurationDays: 0 }
  }
  const totalStartDay = Math.min(...tasks.map(t => t.startDay))
  const totalEndDay   = Math.max(...tasks.map(t => t.endDay))
  return { totalStartDay, totalEndDay, totalDurationDays: totalEndDay - totalStartDay }
}

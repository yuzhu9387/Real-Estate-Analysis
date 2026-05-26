import type { TaskStatus } from '@/db/schema'

export type TaskStatusLevel = 'on_track' | 'at_risk' | 'delay'

export type CurrentTaskStatus = {
  level: TaskStatusLevel
  daysBehind: number
}

export function currentTaskStatus(
  input: { status: TaskStatus; isBlocked: boolean; plannedEndDay: number | null },
  todayDayOffset: number,
): CurrentTaskStatus {
  const terminal = input.status === 'complete' || input.status === 'wont_do'
  if (terminal) return { level: 'on_track', daysBehind: 0 }

  if (input.plannedEndDay !== null && todayDayOffset > input.plannedEndDay) {
    return { level: 'delay', daysBehind: todayDayOffset - input.plannedEndDay }
  }
  if (input.isBlocked) return { level: 'at_risk', daysBehind: 0 }
  return { level: 'on_track', daysBehind: 0 }
}

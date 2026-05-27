import type { TaskPriority } from '@/db/schema'

export type TaskRanked = {
  id: string
  isBlocked: boolean
  plannedEndDay: number | null
  isOnCriticalPath: boolean
  priority: TaskPriority
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 }

function urgency(plannedEndDay: number | null, todayDayOffset: number): number {
  if (plannedEndDay === null) return Number.POSITIVE_INFINITY
  return plannedEndDay - todayDayOffset
}

export function rankMyOpenTasks(tasks: TaskRanked[], todayDayOffset: number): TaskRanked[] {
  return [...tasks].sort((a, b) => {
    const blockedDiff = (a.isBlocked ? 1 : 0) - (b.isBlocked ? 1 : 0)
    if (blockedDiff !== 0) return blockedDiff
    const urgencyDiff = urgency(a.plannedEndDay, todayDayOffset) - urgency(b.plannedEndDay, todayDayOffset)
    if (urgencyDiff !== 0) return urgencyDiff
    const criticalDiff = (a.isOnCriticalPath ? 0 : 1) - (b.isOnCriticalPath ? 0 : 1)
    if (criticalDiff !== 0) return criticalDiff
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  })
}

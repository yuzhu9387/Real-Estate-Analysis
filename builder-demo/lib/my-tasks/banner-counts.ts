import type { TaskStatus } from '@/db/schema'

export type BannerCountsInput = {
  status: TaskStatus
  isBlocked: boolean
  plannedEndDay: number | null
}

export type BannerCounts = {
  overdue: number
  blocked: number
  ready: number
}

export function computeBannerCounts(
  openTasks: BannerCountsInput[],
  todayDayOffset: number,
): BannerCounts {
  let overdue = 0, blocked = 0, ready = 0
  for (const t of openTasks) {
    if (t.isBlocked) {
      blocked++
      continue
    }
    if (t.plannedEndDay !== null && todayDayOffset > t.plannedEndDay) {
      overdue++
      continue
    }
    ready++
  }
  return { overdue, blocked, ready }
}

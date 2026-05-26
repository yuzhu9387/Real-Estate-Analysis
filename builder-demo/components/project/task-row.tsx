import Link from 'next/link'
import type { Task, User } from '@/db/schema'
import { currentTaskStatus } from '@/lib/project-page/current-task-status'

const LEVEL_STYLES = {
  on_track: { icon: '🟢', color: 'text-emerald-600' },
  at_risk: { icon: '🟠', color: 'text-amber-600' },
  delay: { icon: '🔴', color: 'text-red-600' },
} as const

export function TaskRow({
  task, owner, todayDayOffset, urlSearch,
}: {
  task: Task
  owner: User | undefined
  todayDayOffset: number
  urlSearch: URLSearchParams
}) {
  const { level, daysBehind } = currentTaskStatus(
    { status: task.status, isBlocked: task.isBlocked, plannedEndDay: task.plannedEndDay },
    todayDayOffset,
  )
  const style = LEVEL_STYLES[level]
  const label = level === 'delay' ? `delay ${daysBehind}d` : level === 'at_risk' ? 'at risk' : 'on track'

  const next = new URLSearchParams(urlSearch)
  next.set('task', task.id)

  return (
    <Link href={`?${next.toString()}`} scroll={false} className="block px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
      <div className={`flex items-center gap-3 text-sm ${style.color}`}>
        <span>{style.icon}</span>
        <span className="w-24 shrink-0">{label}</span>
        <span className="flex-1 truncate">{task.name}{task.isUnplanned && <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">unplanned</span>}</span>
        <span className="text-zinc-600">{owner?.name ?? '—'}</span>
      </div>
    </Link>
  )
}

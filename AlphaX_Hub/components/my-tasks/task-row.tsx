import Link from 'next/link'
import { Avatar } from '@/components/shared/avatar'
import type { TaskWithContext } from '@/db/queries/my-tasks'
import { currentTaskStatus } from '@/lib/project-page/current-task-status'
import type { User } from '@/db/schema'

const LEVEL_STYLES = {
  on_track: { icon: '🟢', color: 'text-emerald-600' },
  at_risk: { icon: '🟠', color: 'text-amber-600' },
  delay: { icon: '🔴', color: 'text-red-600' },
} as const

function dueText(plannedEndDay: number | null, todayDayOffset: number): string {
  if (plannedEndDay === null) return 'no due date'
  const diff = plannedEndDay - todayDayOffset
  if (diff < 0) return `overdue ${-diff}d`
  if (diff === 0) return 'due today'
  return `due in ${diff}d`
}

export function TaskRow({
  item, todayDayOffset, variant, owner,
}: {
  item: TaskWithContext
  todayDayOffset: number
  variant: 'open' | 'pending_review' | 'completed'
  owner?: User | undefined
}) {
  const { task, project, phase } = item
  const phaseSlug = phase.name.toLowerCase()
  const href = `/projects/${project.id}?tab=${phaseSlug}&task=${task.id}`

  if (variant === 'completed') {
    const icon = task.status === 'complete' ? '✓' : '✗'
    const completedAgo = `${Math.floor((Date.now() - new Date(task.updatedAt).getTime()) / (24 * 60 * 60 * 1000))}d ago`
    return (
      <Link href={href} className="block px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <span className="w-4 text-emerald-600">{icon}</span>
          <span className="flex-1 truncate line-through">{task.name}</span>
          <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded">{project.name} · {phase.name}</span>
          <span className="text-xs">{completedAgo}</span>
        </div>
      </Link>
    )
  }

  const { level, daysBehind } = currentTaskStatus(
    { status: task.status, isBlocked: task.isBlocked, plannedEndDay: task.plannedEndDay },
    todayDayOffset,
  )
  const style = LEVEL_STYLES[level]
  const label = level === 'delay' ? `delay ${daysBehind}d` : level === 'at_risk' ? 'at risk' : 'on track'

  return (
    <Link href={href} className="block px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
      <div className={`flex items-center gap-3 text-sm ${style.color}`}>
        <span>{style.icon}</span>
        <span className="w-24 shrink-0 text-xs">{label}</span>
        {variant === 'pending_review' && owner && (
          <span className="flex items-center gap-1.5 shrink-0">
            <Avatar user={owner} size="xs" />
            <span className="text-xs text-zinc-600">{owner.name}</span>
          </span>
        )}
        <span className="flex-1 truncate">
          {task.name}
          {task.priority === 'high' && <span className="ml-2 text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">🌶️ HIGH</span>}
          {task.isUnplanned && <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">📍 unplanned</span>}
        </span>
        <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">{project.name} · {phase.name}</span>
        <span className="text-xs text-zinc-600 w-24 text-right">{dueText(task.plannedEndDay, todayDayOffset)}</span>
      </div>
    </Link>
  )
}

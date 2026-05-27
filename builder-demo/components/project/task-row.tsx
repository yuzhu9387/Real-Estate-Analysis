'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { Task, User } from '@/db/schema'
import { currentTaskStatus } from '@/lib/project-page/current-task-status'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { deleteTaskInDraft } from '@/app/actions/tasks'

const LEVEL_STYLES = {
  on_track: { icon: '🟢', color: 'text-emerald-600' },
  at_risk: { icon: '🟠', color: 'text-amber-600' },
  delay: { icon: '🔴', color: 'text-red-600' },
} as const

export function TaskRow({
  task, owner, todayDayOffset, urlSearch, project,
}: {
  task: Task
  owner: User | undefined
  todayDayOffset: number
  urlSearch: URLSearchParams
  project: { id: string; pmId: string; status: 'draft' | 'in_progress' | 'complete' | 'archived' }
}) {
  const { can } = usePermissions()
  const [busy, setBusy] = useState(false)
  const { level, daysBehind } = currentTaskStatus(
    { status: task.status, isBlocked: task.isBlocked, plannedEndDay: task.plannedEndDay },
    todayDayOffset,
  )
  const style = LEVEL_STYLES[level]
  const label = level === 'delay' ? `delay ${daysBehind}d` : level === 'at_risk' ? 'at risk' : 'on track'

  const next = new URLSearchParams(urlSearch)
  next.set('task', task.id)
  const href = `?${next.toString()}`

  const canDelete = project.status === 'draft'
    && can({ type: 'task.update_structure', project })

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Delete "${task.name}"? This cannot be undone.`)) return
    setBusy(true)
    try {
      await deleteTaskInDraft({ taskId: task.id })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0 flex items-center gap-3">
      <Link href={href} scroll={false} className={`flex-1 flex items-center gap-3 text-sm ${style.color}`}>
        <span>{style.icon}</span>
        <span className="w-24 shrink-0">{label}</span>
        <span className="flex-1 truncate">
          {task.name}
          {task.isUnplanned && <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">unplanned</span>}
        </span>
        <span className="text-zinc-600">{owner?.name ?? '—'}</span>
      </Link>
      {canDelete && (
        <button
          onClick={onDelete}
          disabled={busy}
          aria-label={`delete ${task.name}`}
          className="text-zinc-400 hover:text-red-600 px-1 text-base disabled:opacity-50">
          ×
        </button>
      )}
    </div>
  )
}

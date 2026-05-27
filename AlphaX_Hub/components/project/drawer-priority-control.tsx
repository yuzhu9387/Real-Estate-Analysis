'use client'
import { useState } from 'react'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { setTaskPriority } from '@/app/actions/tasks'
import type { Task, ProjectStatus, TaskPriority } from '@/db/schema'

const OPTIONS: Array<{ value: TaskPriority; label: string; icon: string }> = [
  { value: 'high', label: 'High', icon: '🌶️' },
  { value: 'normal', label: 'Normal', icon: '·' },
  { value: 'low', label: 'Low', icon: '↓' },
]

export function DrawerPriorityControl({
  task, project,
}: {
  task: Task
  project: { id: string; pmId: string; status: ProjectStatus }
}) {
  const { can } = usePermissions()
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [busy, setBusy] = useState(false)
  const allowed = can({
    type: 'task.set_priority',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  if (!allowed) return null

  async function update(next: TaskPriority) {
    if (next === priority) return
    setBusy(true)
    try {
      await setTaskPriority({ taskId: task.id, priority: next })
      setPriority(next)
    } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-2 text-xs mt-3">
      <span className="text-zinc-500">Priority:</span>
      <div className="flex gap-1">
        {OPTIONS.map(o => (
          <button key={o.value} onClick={() => update(o.value)} disabled={busy}
            className={[
              'px-2 py-0.5 rounded',
              priority === o.value
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50',
            ].join(' ')}>
            <span className="mr-1">{o.icon}</span>{o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

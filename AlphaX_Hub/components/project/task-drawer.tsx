'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { Avatar } from '@/components/shared/avatar'
import { DrawerStatusStepper } from './drawer-status-stepper'
import { DrawerStatusActions } from './drawer-status-actions'
import { DrawerSubtasks } from './drawer-subtasks'
import { DrawerComments } from './drawer-comments'
import { DrawerPriorityControl } from './drawer-priority-control'
import { currentTaskStatus } from '@/lib/project-page/current-task-status'
import type { ProjectPageData } from '@/db/queries/project-page'

export function TaskDrawer({
  projectId, taskId, initialData,
}: {
  projectId: string
  taskId: string
  initialData: ProjectPageData
}) {
  const router = useRouter()
  const search = useSearchParams()

  const task = initialData.tasks.find(t => t.id === taskId)
  const owner = task && initialData.users.find(u => u.id === task.ownerId)
  const reviewer = task && task.reviewerId ? initialData.users.find(u => u.id === task.reviewerId) : null
  const workflow = task && initialData.workflows.find(w => w.id === task.projectWorkflowId)
  const phase = workflow && initialData.phases.find(p => p.id === workflow.projectPhaseId)

  const today = new Date()
  const kickoff = initialData.project.kickedOffAt ? new Date(initialData.project.kickedOffAt) : today
  const todayDayOffset = Math.max(0, Math.floor((today.getTime() - kickoff.getTime()) / (24 * 60 * 60 * 1000)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function close() {
    const next = new URLSearchParams(search)
    next.delete('task')
    router.push(`?${next.toString()}`, { scroll: false })
  }

  if (!task) return null

  const cts = currentTaskStatus(
    { status: task.status, isBlocked: task.isBlocked, plannedEndDay: task.plannedEndDay },
    todayDayOffset,
  )
  const riskLabel = cts.level === 'delay' ? `🔴 delay ${cts.daysBehind}d`
    : cts.level === 'at_risk' ? '🟠 at risk'
    : '🟢 on track'

  const upstreamTaskIds = initialData.taskDeps.filter(d => d.toTaskId === task.id).map(d => d.fromTaskId)
  const upstreamTasks = upstreamTaskIds.map(id => initialData.tasks.find(t => t.id === id)).filter(Boolean)

  return (
    <div className="fixed inset-y-0 right-0 w-[380px] bg-white border-l border-zinc-200 shadow-2xl z-40 overflow-y-auto">
      <button onClick={close} className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-900 text-xl leading-none">×</button>

      <div className="p-4 pr-10">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500">
          {workflow?.name} · {phase?.name}
        </div>
        <h3 className="text-base font-semibold mt-1">{task.name}</h3>
        <div className="text-xs mt-1">
          {riskLabel} {task.isOnCriticalPath && <span className="text-red-600">· on critical path</span>}
        </div>

        <div className="mt-4 p-3 bg-zinc-50 rounded-lg flex gap-3">
          <div className="flex-1">
            <div className="text-[10px] uppercase text-zinc-500">Owner</div>
            <div className="flex items-center gap-2 mt-1">
              {owner && <Avatar user={owner} size="sm" />}
              <strong className="text-sm">{owner?.name ?? '—'}</strong>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase text-zinc-500">Reviewer</div>
            <div className="flex items-center gap-2 mt-1">
              {reviewer ? <Avatar user={reviewer} size="sm" /> : null}
              <strong className="text-sm">{reviewer?.name ?? '—'}</strong>
            </div>
          </div>
        </div>

        <DrawerPriorityControl task={task} project={initialData.project} />

        <div className="mt-4">
          <DrawerStatusStepper status={task.status} hasReviewer={!!task.reviewerId} />
        </div>

        <div className="mt-4">
          <DrawerStatusActions task={task} project={initialData.project} />
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <span className="text-zinc-500">Planned</span>
          <span>Day {task.plannedStartDay ?? '?'}–{task.plannedEndDay ?? '?'} ({task.plannedDurationDays}d)</span>
          {task.actualStartDay !== null && <>
            <span className="text-zinc-500">Actual start</span>
            <span>Day {task.actualStartDay}</span>
          </>}
          {task.actualEndDay !== null && <>
            <span className="text-zinc-500">Actual end</span>
            <span>Day {task.actualEndDay}</span>
          </>}
          <span className="text-zinc-500">Depends on</span>
          <span>{upstreamTasks.length === 0 ? '—' : upstreamTasks.map(t => t!.name).join(', ')}</span>
        </div>

        <DrawerSubtasks task={task} allTasks={initialData.tasks} />

        <DrawerComments taskId={task.id} />

        <div className="mt-6 pt-4 border-t border-zinc-200 text-xs">
          <a href={`/tasks/${task.id}`} className="text-blue-600 hover:underline inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Open in full page
          </a>
        </div>
      </div>
    </div>
  )
}

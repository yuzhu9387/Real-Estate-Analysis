import type { Task, User } from '@/db/schema'
import { TaskRow } from './task-row'
import { AddTaskButton } from './add-task-button'

export function TaskList({
  phaseName, tasks, users, project, todayDayOffset, workflowIds, urlSearch,
}: {
  phaseName: 'Permitting' | 'Construction' | 'Sale'
  tasks: Task[]
  users: User[]
  project: { id: string; pmId: string; status: 'draft'|'in_progress'|'complete'|'archived' }
  todayDayOffset: number
  workflowIds: string[]
  urlSearch: URLSearchParams
}) {
  const phaseTasks = tasks.filter(t => workflowIds.includes(t.projectWorkflowId))
  const userById = new Map(users.map(u => [u.id, u]))

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-center mb-2">
        <div className="text-xs uppercase text-zinc-600">Tasks in {phaseName} ({phaseTasks.length})</div>
        <AddTaskButton project={project} phaseName={phaseName} workflowIds={workflowIds} />
      </div>
      <div className="max-h-64 overflow-auto border border-zinc-100 rounded">
        {phaseTasks.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">No tasks in this phase yet.</div>
        ) : (
          phaseTasks.map(t => (
            <TaskRow key={t.id} task={t} owner={userById.get(t.ownerId)} todayDayOffset={todayDayOffset} urlSearch={urlSearch} project={project} />
          ))
        )}
      </div>
    </div>
  )
}

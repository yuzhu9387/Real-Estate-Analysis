'use client'
import { useState } from 'react'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { AddTaskDialog } from './add-task-dialog'

export function AddTaskButton({
  project, phaseName, workflowIds,
}: {
  project: { id: string; pmId: string; status: 'draft'|'in_progress'|'complete'|'archived' }
  phaseName: 'Permitting' | 'Construction' | 'Sale'
  workflowIds: string[]
}) {
  const [open, setOpen] = useState(false)
  const { can } = usePermissions()
  const isDraft = project.status === 'draft'
  const canAddPlanned = can({ type: 'task.add_planned', project })
  const canAddUnplanned = can({ type: 'task.add_unplanned', project })
  if (isDraft ? !canAddPlanned : !canAddUnplanned) return null

  return (
    <>
      <button onClick={() => setOpen(true)} className="ml-auto bg-white border border-zinc-300 rounded px-2 py-1 text-xs hover:bg-zinc-50">
        {isDraft ? '+ Add task' : '+ Add unplanned task'}
      </button>
      {open && <AddTaskDialog project={project} phaseName={phaseName} workflowIds={workflowIds} onClose={() => setOpen(false)} />}
    </>
  )
}

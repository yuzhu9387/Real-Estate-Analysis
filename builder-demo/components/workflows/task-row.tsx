'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DepPicker } from './dep-picker'
import type { DraftTask } from '@/lib/workflow-editor/draft-storage'

const ROLE_SUGGESTIONS = ['design', 'construction', 'sales', 'development']

export function TaskRow({
  task, sortIndex, allTasks, depUpstreamIds,
  onChange, onDelete, onAddDep, onRemoveDep,
}: {
  task: DraftTask
  sortIndex: number
  allTasks: Array<{ id: string; name: string; sortOrder: number }>
  depUpstreamIds: string[]
  onChange: (patch: Partial<DraftTask>) => void
  onDelete: () => void
  onAddDep: (upstreamTaskId: string) => void
  onRemoveDep: (upstreamTaskId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}
      className="border border-zinc-200 rounded p-2 bg-white flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners}
          className="cursor-grab text-zinc-400 hover:text-zinc-700 px-1"
          aria-label="drag to reorder">⠿</button>
        <span className="text-xs font-semibold w-6 shrink-0">{sortIndex + 1}.</span>
        <input
          value={task.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Task name"
          className="flex-1 border-b border-transparent focus:border-zinc-300 outline-none text-sm px-1"
        />
        <input
          type="number"
          min="0"
          value={task.durationDays}
          onChange={(e) => onChange({ durationDays: Number(e.target.value) })}
          className="w-14 border border-zinc-200 rounded px-1 text-sm text-right"
        />
        <span className="text-xs text-zinc-500">d</span>
        <input
          list="owner-role-suggestions"
          value={task.ownerRoleLabel}
          onChange={(e) => onChange({ ownerRoleLabel: e.target.value })}
          placeholder="Owner role"
          className="w-32 border border-zinc-200 rounded px-1 text-sm"
        />
        <datalist id="owner-role-suggestions">
          {ROLE_SUGGESTIONS.map(r => <option key={r} value={r} />)}
        </datalist>
        <button onClick={onDelete}
          className="text-zinc-400 hover:text-red-600 px-1 text-xs"
          aria-label="delete task">×</button>
      </div>
      <div className="pl-10">
        <DepPicker
          taskId={task.id}
          allTasks={allTasks}
          currentDepIds={depUpstreamIds}
          onAdd={onAddDep}
          onRemove={onRemoveDep}
        />
      </div>
    </div>
  )
}

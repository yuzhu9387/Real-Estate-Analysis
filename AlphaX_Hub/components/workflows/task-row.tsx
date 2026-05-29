'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DepPicker } from './dep-picker'
import type { DraftTask } from '@/lib/workflow-editor/draft-storage'

const ROLE_SUGGESTIONS = ['design', 'construction', 'sales', 'development']

export function TaskRow({
  task,
  sortIndex,
  allTasks,
  depUpstreamIds,
  onChange,
  onDelete,
  onAddDep,
  onRemoveDep,
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  const duration = task.endDay - task.startDay

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-outline-variant/30 bg-white px-md py-sm shadow-sm hover:border-outline-variant/60 transition-colors"
    >
      <div className="flex items-center gap-sm">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-outline hover:text-on-surface px-xs"
          aria-label="drag to reorder"
        >
          <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
        </button>
        <span className="font-data-display text-body-sm text-outline w-6 shrink-0 text-right">
          {String(sortIndex + 1).padStart(2, '0')}
        </span>
        <input
          value={task.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Task name"
          className="flex-1 min-w-0 bg-transparent border-b border-transparent focus:border-primary outline-none text-body-md text-on-surface px-xs py-xs transition-colors placeholder:text-outline/60"
        />

        <div className="flex items-center gap-xs shrink-0">
          <DayField
            label="Start"
            value={task.startDay}
            onChange={(n) => onChange({ startDay: n })}
          />
          <span className="text-outline">→</span>
          <DayField
            label="End"
            value={task.endDay}
            onChange={(n) =>
              onChange({ endDay: Number.isNaN(n) ? task.startDay : n })
            }
          />
          <span className="font-data-display text-body-sm text-on-surface-variant tabular-nums whitespace-nowrap min-w-[2.5rem] text-right">
            {duration}d
          </span>
        </div>

        <input
          list="owner-role-suggestions"
          value={task.ownerRoleLabel}
          onChange={(e) => onChange({ ownerRoleLabel: e.target.value })}
          placeholder="Owner role"
          className="w-32 h-9 rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm focus:outline-none focus:border-primary transition-colors"
        />
        <datalist id="owner-role-suggestions">
          {ROLE_SUGGESTIONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={onDelete}
          className="text-outline hover:text-error transition-colors px-xs"
          aria-label="delete task"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div className="pl-[40px] pt-xs">
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

function DayField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="flex items-center gap-xs">
      <span className="text-label-caps font-label-caps text-outline tracking-widest">
        {label}
      </span>
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 1 : Number(e.target.value))}
        onFocus={(e) => e.target.select()}
        className="no-spin w-14 h-9 rounded-lg border border-outline-variant/40 bg-white px-xs text-body-sm font-data-display text-on-surface text-right focus:outline-none focus:border-primary transition-colors"
        aria-label={`${label.toLowerCase()} day`}
      />
    </label>
  )
}

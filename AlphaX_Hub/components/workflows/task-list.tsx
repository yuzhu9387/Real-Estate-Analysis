'use client'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskRow } from './task-row'
import type { DraftTask, DraftDep } from '@/lib/workflow-editor/draft-storage'

export function TaskList({
  tasks,
  deps,
  onReorder,
  onChangeTask,
  onDeleteTask,
  onAddDep,
  onRemoveDep,
  onAddTask,
}: {
  tasks: DraftTask[]
  deps: DraftDep[]
  onReorder: (newOrder: DraftTask[]) => void
  onChangeTask: (taskId: string, patch: Partial<DraftTask>) => void
  onDeleteTask: (taskId: string) => void
  onAddDep: (taskId: string, upstreamTaskId: string) => void
  onRemoveDep: (taskId: string, upstreamTaskId: string) => void
  onAddTask: () => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = tasks.findIndex((t) => t.id === active.id)
    const newIndex = tasks.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const moved = arrayMove(tasks, oldIndex, newIndex)
    const renumbered = moved.map((t, i) => ({ ...t, sortOrder: i }))
    onReorder(renumbered)
  }

  return (
    <div className="space-y-sm">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t, i) => {
            const upstreamIds = deps.filter((d) => d.toTaskId === t.id).map((d) => d.fromTaskId)
            return (
              <TaskRow
                key={t.id}
                task={t}
                sortIndex={i}
                allTasks={tasks}
                depUpstreamIds={upstreamIds}
                onChange={(patch) => onChangeTask(t.id, patch)}
                onDelete={() => onDeleteTask(t.id)}
                onAddDep={(upstreamId) => onAddDep(t.id, upstreamId)}
                onRemoveDep={(upstreamId) => onRemoveDep(t.id, upstreamId)}
              />
            )
          })}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={onAddTask}
        className="w-full rounded-xl border-2 border-dashed border-outline-variant/40 bg-white/50 py-sm text-label-caps font-label-caps tracking-widest text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
      >
        + ADD TASK
      </button>
    </div>
  )
}

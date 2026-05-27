'use client'
import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { WorkflowChip } from './workflow-chip'
import type { Assignment } from '@/lib/new-project-wizard/validate'

export function WorkflowPhaseRow({
  phase, required, isError,
  assignments, availableTemplates,
  onAdd, onRemove, onReorder,
}: {
  phase: 'Permitting' | 'Construction' | 'Sale'
  required: boolean
  isError: boolean
  assignments: Assignment[]
  availableTemplates: Array<{ id: string; name: string }>
  onAdd: (templateId: string, templateName: string) => void
  onRemove: (assignmentId: string) => void
  onReorder: (newOrder: Assignment[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const assignedTemplateIds = new Set(assignments.map(a => a.templateId))
  const pickable = availableTemplates.filter(t => !assignedTemplateIds.has(t.id))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = assignments.findIndex(a => a.id === active.id)
    const newIndex = assignments.findIndex(a => a.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const moved = arrayMove(assignments, oldIndex, newIndex)
    const renumbered = moved.map((a, i) => ({ ...a, sortOrder: i }))
    onReorder(renumbered)
  }

  return (
    <div className="space-y-2">
      <div className="font-medium text-sm">
        {phase}
        {required && <span className="text-red-600 ml-1">*</span>}
        {!required && <span className="text-zinc-500 font-normal ml-1">(optional)</span>}
      </div>
      <div className={`rounded border p-2 ${isError ? 'border-red-300 bg-red-50' : 'border-zinc-200 bg-white'}`}>
        {assignments.length === 0 ? (
          <span className="text-xs text-zinc-500 italic mr-2">No workflows assigned.</span>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={assignments.map(a => a.id)} strategy={horizontalListSortingStrategy}>
              <div className="inline-flex flex-wrap gap-2 mr-2">
                {assignments.map(a => (
                  <WorkflowChip
                    key={a.id}
                    id={a.id}
                    name={a.templateName}
                    onRemove={() => onRemove(a.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setPickerOpen(o => !o)}
            disabled={pickable.length === 0}
            className="text-xs text-blue-600 hover:underline disabled:text-zinc-400 disabled:no-underline">
            + Add workflow{pickable.length === 0 ? ' (none available)' : ' ▾'}
          </button>
          {pickerOpen && pickable.length > 0 && (
            <div className="absolute z-10 mt-1 bg-white border border-zinc-200 rounded shadow-lg min-w-[200px] max-h-60 overflow-y-auto">
              {pickable.map(t => (
                <button key={t.id}
                  type="button"
                  onClick={() => { onAdd(t.id, t.name); setPickerOpen(false) }}
                  className="block w-full text-left px-2 py-1 text-xs hover:bg-zinc-100">
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

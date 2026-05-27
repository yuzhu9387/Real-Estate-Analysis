'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function WorkflowChip({
  id, name, onRemove,
}: {
  id: string
  name: string
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <span ref={setNodeRef} style={style}
      className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
      <button {...attributes} {...listeners}
        className="cursor-grab text-blue-600 hover:text-blue-900"
        aria-label={`drag to reorder ${name}`}>⠿</button>
      <span>{name}</span>
      <button onClick={onRemove}
        aria-label={`remove ${name}`}
        className="hover:text-blue-900">×</button>
    </span>
  )
}

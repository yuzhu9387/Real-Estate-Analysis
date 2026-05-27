'use client'
import { useState } from 'react'

export function DepPicker({
  taskId, allTasks, currentDepIds, onAdd, onRemove,
}: {
  taskId: string
  allTasks: Array<{ id: string; name: string; sortOrder: number }>
  currentDepIds: string[]
  onAdd: (upstreamTaskId: string) => void
  onRemove: (upstreamTaskId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const self = allTasks.find(t => t.id === taskId)
  const candidates = self
    ? allTasks.filter(t => t.id !== taskId && t.sortOrder < self.sortOrder && !currentDepIds.includes(t.id))
    : []

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="text-zinc-500">depends on:</span>
      {currentDepIds.length === 0 && <span className="text-zinc-400 italic">(none)</span>}
      {currentDepIds.map(depId => {
        const dep = allTasks.find(t => t.id === depId)
        if (!dep) return null
        return (
          <span key={depId} className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
            {dep.name}
            <button onClick={() => onRemove(depId)} className="hover:text-blue-900" aria-label={`remove dep ${dep.name}`}>×</button>
          </span>
        )
      })}
      {candidates.length > 0 && (
        <div className="relative">
          <button onClick={() => setOpen(o => !o)} className="text-blue-600 hover:underline">+ add</button>
          {open && (
            <div className="absolute z-10 mt-1 bg-white border border-zinc-200 rounded shadow-lg min-w-[180px]">
              {candidates.map(c => (
                <button key={c.id}
                  onClick={() => { onAdd(c.id); setOpen(false) }}
                  className="block w-full text-left px-2 py-1 hover:bg-zinc-100">
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

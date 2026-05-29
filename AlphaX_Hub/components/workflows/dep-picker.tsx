'use client'
import { useEffect, useRef, useState } from 'react'

export function DepPicker({
  taskId,
  allTasks,
  currentDepIds,
  onAdd,
  onRemove,
}: {
  taskId: string
  allTasks: Array<{ id: string; name: string; sortOrder: number }>
  currentDepIds: string[]
  onAdd: (upstreamTaskId: string) => void
  onRemove: (upstreamTaskId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const self = allTasks.find((t) => t.id === taskId)
  const candidates = self
    ? allTasks.filter(
        (t) => t.id !== taskId && t.sortOrder < self.sortOrder && !currentDepIds.includes(t.id),
      )
    : []

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-xs text-body-sm">
      <span className="text-label-caps font-label-caps text-outline tracking-widest shrink-0">
        Depends on
      </span>

      <div className="flex flex-wrap items-center gap-xs flex-1 min-w-0">
        {currentDepIds.length === 0 ? (
          <span className="text-outline italic">none</span>
        ) : (
          currentDepIds.map((depId) => {
            const dep = allTasks.find((t) => t.id === depId)
            if (!dep) return null
            return (
              <span
                key={depId}
                className="inline-flex items-center gap-xs h-7 px-sm rounded-full border border-primary/20 bg-primary/10 text-primary text-[12px] font-semibold"
              >
                {dep.name || '(unnamed)'}
                <button
                  type="button"
                  onClick={() => onRemove(depId)}
                  className="hover:text-primary/80"
                  aria-label={`remove dep ${dep.name}`}
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            )
          })
        )}
      </div>

      {candidates.length > 0 && (
        <div className="relative ml-auto shrink-0" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-xs h-7 px-sm rounded-full border border-outline-variant/40 bg-white text-[12px] font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            Add dependency
          </button>
          {open && (
            <div className="absolute z-20 right-0 mt-xs min-w-[240px] rounded-lg border border-outline-variant/30 bg-white shadow-xl overflow-hidden">
              <div className="px-md py-xs text-label-caps font-label-caps text-outline tracking-widest border-b border-outline-variant/20 bg-surface-container-low/60">
                Add upstream task
              </div>
              <ul className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/20">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onAdd(c.id)
                        setOpen(false)
                      }}
                      className="flex items-center gap-sm w-full text-left px-md py-sm text-body-sm text-on-surface hover:bg-primary/5 hover:text-primary transition-colors"
                    >
                      <span className="font-data-display text-[11px] text-outline shrink-0 w-6 text-right">
                        {String(c.sortOrder + 1).padStart(2, '0')}
                      </span>
                      <span className="truncate">{c.name || '(unnamed)'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

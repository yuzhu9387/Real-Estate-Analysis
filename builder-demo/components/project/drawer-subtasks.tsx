'use client'
import { useState } from 'react'
import { addSubtask, setTaskStatus } from '@/app/actions/tasks'
import { usePermissions } from '@/lib/hooks/use-permissions'
import type { Task } from '@/db/schema'

export function DrawerSubtasks({ task, allTasks }: { task: Task; allTasks: Task[] }) {
  const subtasks = allTasks.filter(t => t.parentTaskId === task.id)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const { user } = usePermissions()

  async function create() {
    if (!name.trim() || !user) return
    setBusy(true)
    try {
      await addSubtask({ parentTaskId: task.id, name, ownerId: user.id })
      setName(''); setAdding(false)
    } finally { setBusy(false) }
  }

  async function toggleSubtask(sub: Task) {
    const next = sub.status === 'complete' ? 'not_started' : 'complete'
    await setTaskStatus({ taskId: sub.id, status: next })
  }

  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase text-zinc-500">Subtasks ({subtasks.length})</div>
      <div className="text-sm mt-1 space-y-0.5">
        {subtasks.map(s => (
          <div key={s.id} className="flex items-center gap-2">
            <button onClick={() => toggleSubtask(s)} className="text-zinc-500 hover:text-zinc-900">
              {s.status === 'complete' ? '✓' : '○'}
            </button>
            <span className={s.status === 'complete' ? 'line-through text-zinc-500' : ''}>{s.name}</span>
          </div>
        ))}
      </div>
      {adding ? (
        <div className="mt-2 flex gap-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Subtask name"
            className="flex-1 border rounded px-2 py-1 text-xs" autoFocus />
          <button onClick={create} disabled={busy} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Add</button>
          <button onClick={() => { setAdding(false); setName('') }} className="border rounded px-2 py-1 text-xs">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-blue-600 text-xs mt-1">+ Add subtask</button>
      )}
    </div>
  )
}

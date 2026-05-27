'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { addPlannedTask, addUnplannedTask } from '@/app/actions/tasks'

export function AddTaskDialog({
  project, phaseName, workflowIds, onClose,
}: {
  project: { id: string; pmId: string; status: 'draft'|'in_progress'|'complete'|'archived' }
  phaseName: 'Permitting' | 'Construction' | 'Sale'
  workflowIds: string[]
  onClose: () => void
}) {
  const isDraft = project.status === 'draft'
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [tasks, setTasks] = useState<Array<{ id: string; name: string; projectWorkflowId: string }>>([])
  const [form, setForm] = useState({
    name: '', plannedDurationDays: 1, ownerId: '', reviewerId: '',
    description: '', workflowId: workflowIds[0] ?? '',
    upstreamTaskId: '',
  })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/users/active').then(r => r.json()).then(d => setUsers(d.users ?? [])),
      fetch(`/api/projects/${project.id}/tasks`).then(r => r.json()).then(d => setTasks(d.tasks ?? [])),
    ])
  }, [project.id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      if (isDraft) {
        await addPlannedTask({
          projectId: project.id,
          projectWorkflowId: form.workflowId,
          name: form.name,
          plannedDurationDays: form.plannedDurationDays,
          ownerId: form.ownerId,
          reviewerId: form.reviewerId || null,
          description: form.description || null,
          upstreamTaskIds: form.upstreamTaskId ? [form.upstreamTaskId] : undefined,
        })
      } else {
        await addUnplannedTask({
          projectId: project.id,
          projectWorkflowId: form.workflowId,
          name: form.name,
          plannedDurationDays: form.plannedDurationDays,
          ownerId: form.ownerId,
          reviewerId: form.reviewerId || null,
          description: form.description || null,
          upstreamTaskId: form.upstreamTaskId || null,
        })
      }
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed')
    } finally { setBusy(false) }
  }

  const tasksInPhase = tasks.filter(t => workflowIds.includes(t.projectWorkflowId))

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-lg p-6 shadow-xl z-50">
          <Dialog.Title className="text-lg font-semibold">{isDraft ? `Add task to ${phaseName}` : `Add unplanned task to ${phaseName}`}</Dialog.Title>
          <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="text-xs text-zinc-600">Name</span>
              <input required value={form.name} onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1" />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-600">Workflow</span>
              <select required value={form.workflowId} onChange={(e) => setForm(s => ({ ...s, workflowId: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1">
                <option value="">— pick a workflow —</option>
                {workflowIds.map(id => <option key={id} value={id}>{id.slice(0, 8)}…</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-zinc-600">Duration (days)</span>
                <input type="number" required min="0" value={form.plannedDurationDays} onChange={(e) => setForm(s => ({ ...s, plannedDurationDays: Number(e.target.value) }))} className="mt-1 w-full border rounded px-2 py-1" />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-600">Owner</span>
                <select required value={form.ownerId} onChange={(e) => setForm(s => ({ ...s, ownerId: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1">
                  <option value="">— pick user —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-zinc-600">Reviewer (optional)</span>
              <select value={form.reviewerId} onChange={(e) => setForm(s => ({ ...s, reviewerId: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1">
                <option value="">— none —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-zinc-600">Upstream task (optional)</span>
              <select value={form.upstreamTaskId} onChange={(e) => setForm(s => ({ ...s, upstreamTaskId: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1">
                <option value="">— no upstream —</option>
                {tasksInPhase.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-zinc-600">Description (optional)</span>
              <textarea value={form.description} onChange={(e) => setForm(s => ({ ...s, description: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1" rows={2} />
            </label>
            {err && <div className="text-red-600 text-xs">{err}</div>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="border rounded px-3 py-1.5 text-sm">Cancel</button>
              <button type="submit" disabled={busy} className="ml-auto bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50">
                Add task
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

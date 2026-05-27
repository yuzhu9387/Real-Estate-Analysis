'use client'
import { useState } from 'react'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { taskActionState, type TaskActionId } from '@/lib/project-page/task-action-state'
import {
  setTaskStatus, submitTaskForReview, approveTask, requestTaskRevision,
} from '@/app/actions/tasks'
import type { Task, ProjectStatus } from '@/db/schema'

export function DrawerStatusActions({
  task, project,
}: {
  task: Task
  project: { id: string; pmId: string; status: ProjectStatus }
}) {
  const { user } = usePermissions()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showRevisionPrompt, setShowRevisionPrompt] = useState(false)
  const [revisionBody, setRevisionBody] = useState('')

  if (!user) return null

  const state = taskActionState({
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId, status: task.status },
    project: { pmId: project.pmId, status: project.status },
    user: { id: user.id, role: user.role },
  })

  if (!state.primary && !state.secondary) {
    return <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">{state.context}</div>
  }

  async function run(action: TaskActionId) {
    setBusy(true); setErr(null)
    try {
      switch (action) {
        case 'start': await setTaskStatus({ taskId: task.id, status: 'started' }); break
        case 'submit_review': await submitTaskForReview({ taskId: task.id }); break
        case 'mark_complete': await setTaskStatus({ taskId: task.id, status: 'complete' }); break
        case 'wont_do': await setTaskStatus({ taskId: task.id, status: 'wont_do' }); break
        case 'revert': await setTaskStatus({ taskId: task.id, status: 'not_started' }); break
        case 'approve': await approveTask({ taskId: task.id }); break
        case 'request_revision': setShowRevisionPrompt(true); return
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed')
    } finally { setBusy(false) }
  }

  async function submitRevision() {
    if (!revisionBody.trim()) { setErr('Comment required'); return }
    setBusy(true); setErr(null)
    try {
      await requestTaskRevision({ taskId: task.id, body: revisionBody })
      setShowRevisionPrompt(false); setRevisionBody('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs">
      <div className="text-blue-900 mb-2">{state.context}</div>
      <div className="flex gap-2">
        {state.primary && (
          <button onClick={() => run(state.primary!.action)} disabled={busy}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-3 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50">
            {state.primary.label}
          </button>
        )}
        {state.secondary && (
          <button onClick={() => run(state.secondary!.action)} disabled={busy}
            className="bg-white border border-zinc-300 text-zinc-700 px-3 py-1.5 rounded text-xs hover:bg-zinc-50 disabled:opacity-50">
            {state.secondary.label}
          </button>
        )}
      </div>

      {showRevisionPrompt && (
        <div className="mt-2">
          <textarea value={revisionBody} onChange={(e) => setRevisionBody(e.target.value)}
            placeholder="Describe what needs revision"
            className="w-full border rounded px-2 py-1 text-xs" rows={2} />
          <div className="flex gap-2 mt-1">
            <button onClick={() => setShowRevisionPrompt(false)} className="text-xs px-2 py-1 border rounded">Cancel</button>
            <button onClick={submitRevision} disabled={busy} className="ml-auto text-xs px-2 py-1 bg-blue-600 text-white rounded">Send</button>
          </div>
        </div>
      )}

      {err && <div className="text-red-600 text-xs mt-2">{err}</div>}
    </div>
  )
}

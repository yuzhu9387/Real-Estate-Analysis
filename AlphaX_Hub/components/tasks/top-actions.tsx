'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setTaskStatus, deleteTaskInDraft } from '@/app/actions/tasks'
import type { TaskDetail } from '@/db/queries/task-detail'
import { EditTaskMetadataDialog } from './edit-task-metadata-dialog'

type Role = 'owner' | 'pm' | 'ic'

function healthLevel(targetEndDate: string | null, status: string): 'overdue' | 'on_track' {
  if (status === 'complete' || status === 'wont_do') return 'on_track'
  if (!targetEndDate) return 'on_track'
  const today = new Date().toISOString().slice(0, 10)
  return targetEndDate < today ? 'overdue' : 'on_track'
}

export function TopActions({ detail, me }: {
  detail: TaskDetail
  me: { id: string; role: Role }
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const { task, project } = detail
  const canUpdateStructure =
    me.role === 'owner' || (me.role === 'pm' && project.pmId === me.id)
  const canSetStatus = canUpdateStructure || task.ownerId === me.id
  const isDraft = project.status === 'draft'
  // Edit + Delete both go through task.update_structure which requires draft.
  const canEdit = canUpdateStructure && isDraft
  const canDelete = canUpdateStructure && isDraft
  const canWontDo =
    canSetStatus && task.status !== 'wont_do' && task.status !== 'complete'

  const health = healthLevel(task.targetEndDate, task.status)

  async function onDelete() {
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    setBusy(true); setErr(null)
    try {
      await deleteTaskInDraft({ taskId: task.id })
      router.push(`/projects/${project.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed')
    } finally { setBusy(false) }
  }

  async function onWontDo() {
    if (!window.confirm("Mark this task as won't do?")) return
    setBusy(true); setErr(null)
    try {
      await setTaskStatus({ taskId: task.id, status: 'wont_do' })
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex items-start justify-between gap-6 mb-6">
      <div className="min-w-0">
        <h1 className="font-headline-lg text-on-background break-words">{task.name}</h1>
        <div className="mt-2 flex items-center gap-4 text-body-sm">
          {task.status === 'wont_do' ? (
            <span className="inline-flex items-center gap-2 text-body-muted">
              <span className="w-3 h-3 rounded-full bg-surface-container-highest" />
              Won&apos;t do
            </span>
          ) : (
            <>
              {health === 'overdue' ? (
                <span className="inline-flex items-center gap-2 text-error">
                  <span className="w-3 h-3 rounded-full bg-error" />
                  Overdue
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-secondary">
                  <span className="w-3 h-3 rounded-full bg-secondary" />
                  On track
                </span>
              )}
              {task.isOnCriticalPath && (
                <span className="inline-flex items-center gap-2 text-error">
                  <span className="w-3 h-3 rounded-full bg-error" />
                  On critical path
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canEdit && (
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-outline-variant bg-white text-body-sm font-medium text-on-surface-variant hover:text-primary hover:border-primary"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit
          </button>
        )}
        {canDelete && (
          <button
            onClick={onDelete}
            disabled={busy}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-outline-variant bg-white text-body-sm font-medium text-error hover:border-error disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Delete
          </button>
        )}
        {canWontDo && (
          <button
            onClick={onWontDo}
            disabled={busy}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-outline-variant bg-white text-body-sm font-medium text-on-surface-variant hover:text-primary hover:border-primary disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">block</span>
            Won&apos;t do
          </button>
        )}
      </div>

      {err && (
        <div className="absolute mt-16 text-error text-body-sm">{err}</div>
      )}

      {editOpen && (
        <EditTaskMetadataDialog
          detail={detail}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  )
}

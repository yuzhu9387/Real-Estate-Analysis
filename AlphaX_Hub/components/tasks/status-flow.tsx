'use client'
import { useState } from 'react'
import {
  setTaskStatus, submitTaskForReview, approveTask, requestTaskRevision,
} from '@/app/actions/tasks'
import { computeVisibleStages, activeStage, type FlowStage } from '@/lib/tasks/status-flow'
import type { TaskDetail } from '@/db/queries/task-detail'

const STAGE_LABEL: Record<FlowStage, { name: string; sub: string }> = {
  start: { name: 'Start', sub: 'Not started' },
  submit_review: { name: 'Submit to review', sub: 'In progress' },
  complete: { name: 'Complete', sub: 'Completed' },
}

const STAGE_ICON: Record<FlowStage, string> = {
  start: 'play_arrow',
  submit_review: 'radio_button_unchecked',
  complete: 'check_circle',
}

export function StatusFlow({ detail, me }: {
  detail: TaskDetail
  me: { id: string; role: 'owner' | 'pm' | 'ic' }
}) {
  const { task, project, reviewer } = detail
  const hasReviewer = reviewer !== null
  const visible = computeVisibleStages(hasReviewer)
  const current = activeStage(task.status, hasReviewer)

  const isOwner = task.ownerId === me.id
  const isReviewer = task.reviewerId === me.id
  const isPmOrOwner =
    me.role === 'owner' || (me.role === 'pm' && project.pmId === me.id)
  const canSetStatus = isOwner || isPmOrOwner

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [reviseOpen, setReviseOpen] = useState(false)
  const [reviseBody, setReviseBody] = useState('')

  if (current === 'wont_do') {
    return (
      <div className="glacier-panel rounded-xl p-4 mb-5">
        <div className="font-label-caps text-body-muted mb-2">Update status</div>
        <div className="bg-surface-container-low rounded-lg px-4 py-3 text-body-sm text-on-surface-variant">
          Won&apos;t do
        </div>
      </div>
    )
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed')
    } finally { setBusy(false) }
  }

  function renderButton(stage: FlowStage) {
    const isCurrent = stage === current
    if (!isCurrent) return null

    if (stage === 'submit_review' && task.status === 'pending_review') {
      if (isReviewer || isPmOrOwner) {
        return (
          <div className="flex items-center gap-2 mt-2">
            <button
              disabled={busy}
              onClick={() => act(() => approveTask({ taskId: task.id }))}
              className="px-3 h-8 rounded-lg bg-primary text-on-primary font-body-sm font-semibold disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={() => setReviseOpen(true)}
              className="px-3 h-8 rounded-lg border border-outline-variant text-body-sm font-semibold text-on-surface-variant hover:border-primary disabled:opacity-50"
            >
              Request revision
            </button>
          </div>
        )
      }
      return (
        <span className="mt-2 inline-block text-body-sm text-body-muted">Awaiting review</span>
      )
    }

    if (stage === 'start' && task.status === 'not_started' && canSetStatus) {
      return (
        <button
          disabled={busy}
          onClick={() => act(() => setTaskStatus({ taskId: task.id, status: 'started' }))}
          className="mt-2 px-3 h-8 rounded-lg bg-primary text-on-primary font-body-sm font-semibold disabled:opacity-50"
        >
          Start
        </button>
      )
    }
    if (stage === 'submit_review' && task.status === 'started' && canSetStatus) {
      return (
        <button
          disabled={busy}
          onClick={() => act(() => submitTaskForReview({ taskId: task.id }))}
          className="mt-2 px-3 h-8 rounded-lg bg-primary text-on-primary font-body-sm font-semibold disabled:opacity-50"
        >
          Submit to review
        </button>
      )
    }
    if (stage === 'complete' && canSetStatus) {
      if (task.status === 'approved' || (!hasReviewer && task.status === 'started')) {
        return (
          <button
            disabled={busy}
            onClick={() => act(() => setTaskStatus({ taskId: task.id, status: 'complete' }))}
            className="mt-2 px-3 h-8 rounded-lg bg-primary text-on-primary font-body-sm font-semibold disabled:opacity-50"
          >
            Complete
          </button>
        )
      }
    }
    return null
  }

  return (
    <div className="glacier-panel rounded-xl p-4 mb-5">
      <div className="font-label-caps text-body-muted mb-3">Update status</div>
      <div className="grid items-center gap-2"
           style={{ gridTemplateColumns: visible.length === 3 ? '1fr 32px 1fr 32px 1fr' : '1fr 32px 1fr' }}>
        {visible.map((stage, i) => {
          const isActive = stage === current
          const idx = visible.indexOf(current as FlowStage)
          const isPast = idx >= 0 && i < idx
          return (
            <div key={stage} className="contents">
              <div className="flex items-center gap-3">
                <div className={
                  'w-9 h-9 rounded-full grid place-items-center border-2 ' +
                  (isActive
                    ? 'border-tertiary text-tertiary ring-4 ring-tertiary/15 bg-white'
                    : isPast
                      ? 'border-secondary bg-secondary text-on-secondary'
                      : 'border-outline-variant bg-white text-body-muted')
                }>
                  <span className="material-symbols-outlined text-[18px]">{STAGE_ICON[stage]}</span>
                </div>
                <div>
                  <div className="font-body-sm font-semibold text-on-background">{STAGE_LABEL[stage].name}</div>
                  <div className="text-body-muted text-[11px]">{STAGE_LABEL[stage].sub}</div>
                  {renderButton(stage)}
                </div>
              </div>
              {i < visible.length - 1 && (
                <span className="material-symbols-outlined text-outline text-[22px] text-center">
                  chevron_right
                </span>
              )}
            </div>
          )
        })}
      </div>
      {err && <div className="text-error text-body-sm mt-3">{err}</div>}

      {reviseOpen && (
        <ReviseDialog
          busy={busy}
          body={reviseBody}
          onBodyChange={setReviseBody}
          onCancel={() => { setReviseOpen(false); setReviseBody('') }}
          onSubmit={async () => {
            if (!reviseBody.trim()) { setErr('Please enter a revision note.'); return }
            await act(() => requestTaskRevision({ taskId: task.id, body: reviseBody }))
            setReviseOpen(false); setReviseBody('')
          }}
        />
      )}
    </div>
  )
}

function ReviseDialog({
  busy, body, onBodyChange, onCancel, onSubmit,
}: {
  busy: boolean; body: string; onBodyChange: (v: string) => void
  onCancel: () => void; onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
      <div className="bg-white rounded-xl p-6 w-[420px] max-w-[90vw]">
        <h3 className="font-headline-md text-on-background mb-3">Request revision</h3>
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="What needs to change?"
          className="w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
          rows={4}
        />
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 h-9 rounded-lg border border-outline-variant text-body-sm font-semibold"
          >Cancel</button>
          <button
            onClick={onSubmit}
            disabled={busy}
            className="ml-auto px-4 h-9 rounded-lg bg-primary text-on-primary text-body-sm font-semibold disabled:opacity-50"
          >Send</button>
        </div>
      </div>
    </div>
  )
}

'use client'
import Link from 'next/link'
import { useState } from 'react'
import { setTaskStatus, setTaskPriority } from '@/app/actions/tasks'
import type { TaskDetail } from '@/db/queries/task-detail'
import { Avatar } from '@/components/shared/avatar'

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  started: 'In progress',
  pending_review: 'Submitted',
  approved: 'Approved',
  complete: 'Completed',
  wont_do: "Won't do",
}

const PRIORITY_LABEL: Record<string, string> = {
  high: 'High', normal: 'Normal', low: 'Low',
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  const dt = new Date(Number(y), Number(m) - 1, Number(day))
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function SummarySection({ detail, me }: {
  detail: TaskDetail
  me: { id: string; role: 'owner' | 'pm' | 'ic' }
}) {
  const { task, project, owner, reviewer } = detail
  const projectMutable = project.status !== 'archived' && project.status !== 'complete'
  const canSetStatus = projectMutable && (
    me.role === 'owner' ||
    (me.role === 'pm' && project.pmId === me.id) ||
    task.ownerId === me.id
  )
  const canSetPriority = canSetStatus
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function changeStatus(next: string) {
    if (next === task.status) return
    setBusy(true); setErr(null)
    try { await setTaskStatus({ taskId: task.id, status: next }) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Update failed') }
    finally { setBusy(false) }
  }

  async function changePriority(next: string) {
    if (next === task.priority) return
    setBusy(true); setErr(null)
    try { await setTaskPriority({ taskId: task.id, priority: next }) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Update failed') }
    finally { setBusy(false) }
  }

  return (
    <section className="glacier-panel rounded-xl mb-4">
      <h2 className="px-5 pt-5 font-headline-md text-on-background">1. Summary</h2>
      <div className="px-5 pb-6 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
        <Field label="Project">
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center gap-2 text-tertiary hover:underline font-body-sm font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            {project.name}
          </Link>
        </Field>

        <Field label="Owner">
          <div className="flex items-center gap-2">
            <Avatar user={{ id: owner.id, name: owner.name }} size="sm" />
            <span className="font-body-md font-semibold text-on-background">{owner.name}</span>
          </div>
        </Field>

        <Field label="Reviewer">
          {reviewer ? (
            <div className="flex items-center gap-2">
              <Avatar user={{ id: reviewer.id, name: reviewer.name }} size="sm" />
              <span className="font-body-md font-semibold text-on-background">{reviewer.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-body-muted">
              <span className="w-7 h-7 rounded-full bg-surface-container-low" />
              <span>—</span>
            </div>
          )}
        </Field>

        <Field label="Due date">
          <span className="inline-flex items-center gap-2 font-body-sm font-semibold text-on-background">
            <span className="material-symbols-outlined text-[18px] text-body-muted">calendar_today</span>
            {fmtDate(task.targetEndDate)}
          </span>
        </Field>

        <Field label="Priority">
          <select
            value={task.priority}
            disabled={!canSetPriority || busy}
            onChange={(e) => changePriority(e.target.value)}
            className="glacier-select h-10 min-w-[140px] rounded-lg border border-outline-variant bg-white px-3 font-body-sm font-semibold text-on-surface-variant disabled:opacity-50 focus:border-primary focus:outline-none"
          >
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>

        <Field label="Status">
          <select
            value={task.status}
            disabled={!canSetStatus || busy}
            onChange={(e) => changeStatus(e.target.value)}
            className="glacier-select h-10 min-w-[150px] rounded-lg border border-outline-variant bg-white px-3 font-body-sm font-semibold text-on-surface-variant disabled:opacity-50 focus:border-primary focus:outline-none"
          >
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      {err && <div className="px-5 pb-3 text-error text-body-sm">{err}</div>}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-label-caps text-body-muted mb-2">{label}</div>
      <div className="min-h-9 flex items-center">{children}</div>
    </div>
  )
}

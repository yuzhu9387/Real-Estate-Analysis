'use client'
import Link from 'next/link'
import { useState } from 'react'
import { addSubtask, setTaskStatus, updateTaskNotes } from '@/app/actions/tasks'
import { StatusFlow } from './status-flow'
import { Avatar } from '@/components/shared/avatar'
import type { TaskDetail } from '@/db/queries/task-detail'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  const dt = new Date(Number(y), Number(m) - 1, Number(day))
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const STATUS_SHORT: Record<string, string> = {
  not_started: 'Not started',
  started: 'In progress',
  pending_review: 'In review',
  approved: 'Approved',
  complete: 'Completed',
  wont_do: "Won't do",
}

export function DetailsSection({ detail, me }: {
  detail: TaskDetail
  me: { id: string; role: 'owner' | 'pm' | 'ic' }
}) {
  const { task, project, parent, upstreamDeps, subtasks } = detail
  const projectMutable = project.status !== 'archived' && project.status !== 'complete'
  const canEditDescription = projectMutable && (
    task.ownerId === me.id ||
    me.role === 'owner' ||
    (me.role === 'pm' && project.pmId === me.id)
  )
  const canAddSubtask = canEditDescription

  return (
    <section className="glacier-panel rounded-xl mb-4">
      <h2 className="px-5 pt-5 font-headline-md text-on-background">2. Details</h2>
      <div className="px-5 pb-6 pt-4 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-7">
        <div>
          <StatusFlow detail={detail} me={me} />

          <div className="grid grid-cols-2 gap-5 pt-5 border-t border-outline-variant">
            <Info label="Target start date">
              <span className="inline-flex items-center gap-2 font-body-sm font-semibold text-on-background">
                <span className="material-symbols-outlined text-[18px] text-body-muted">calendar_today</span>
                {fmtDate(task.targetStartDate)}
              </span>
            </Info>
            <Info label="Target end date">
              <span className="inline-flex items-center gap-2 font-body-sm font-semibold text-on-background">
                <span className="material-symbols-outlined text-[18px] text-body-muted">calendar_today</span>
                {fmtDate(task.targetEndDate)}
              </span>
            </Info>
            <Info label="Parent task">
              {parent ? (
                <Link href={`/tasks/${parent.id}`}
                      className="inline-flex items-center gap-2 text-tertiary hover:underline font-body-sm font-semibold">
                  <span className="material-symbols-outlined text-[18px]">link</span>
                  {parent.name}
                </Link>
              ) : <span className="font-body-sm text-body-muted">—</span>}
            </Info>
            <Info label="Depends on">
              {upstreamDeps.length === 0
                ? <span className="font-body-sm text-body-muted">—</span>
                : (
                  <div className="flex flex-wrap gap-2">
                    {upstreamDeps.map(d => (
                      <Link key={d.id} href={`/tasks/${d.id}`}
                            className="text-tertiary hover:underline font-body-sm font-semibold">
                        {d.name}
                      </Link>
                    ))}
                  </div>
                )}
            </Info>
          </div>
        </div>

        <div>
          <DescriptionBlock
            taskId={task.id}
            initial={task.description ?? ''}
            canEdit={canEditDescription}
          />
          <SubtasksBlock
            parentTaskId={task.id}
            subtasks={subtasks}
            canAdd={canAddSubtask}
            ownerIdForNewSubtask={me.id}
          />
        </div>
      </div>
    </section>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-h-11">
      <div className="font-label-caps text-body-muted mb-1">{label}</div>
      <div>{children}</div>
    </div>
  )
}

function DescriptionBlock({ taskId, initial, canEdit }: {
  taskId: string; initial: string; canEdit: boolean
}) {
  const [text, setText] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setBusy(true); setErr(null)
    try {
      await updateTaskNotes({ taskId, description: draft })
      setText(draft); setEditing(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="mb-5">
      <div className="font-label-caps text-body-muted mb-1">Description</div>
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
            rows={4}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => { setDraft(text); setEditing(false) }}
              className="px-3 h-8 rounded-lg border border-outline-variant text-body-sm"
            >Cancel</button>
            <button
              onClick={save}
              disabled={busy}
              className="ml-auto px-3 h-8 rounded-lg bg-primary text-on-primary text-body-sm font-semibold disabled:opacity-50"
            >Save</button>
          </div>
          {err && <div className="text-error text-body-sm mt-1">{err}</div>}
        </>
      ) : (
        <div
          onClick={() => canEdit && setEditing(true)}
          className={
            'font-body-sm text-on-surface-variant leading-relaxed mt-1 ' +
            (canEdit ? 'cursor-text hover:bg-surface-container-low rounded p-1 -m-1' : '')
          }
        >
          {text || <span className="text-body-muted italic">No description.</span>}
        </div>
      )}
    </div>
  )
}

function SubtasksBlock({
  parentTaskId, subtasks, canAdd, ownerIdForNewSubtask,
}: {
  parentTaskId: string
  subtasks: TaskDetail['subtasks']
  canAdd: boolean
  ownerIdForNewSubtask: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  async function toggle(subId: string, current: string) {
    setBusy(true); setErr(null)
    const next = current === 'complete' ? 'not_started' : 'complete'
    try {
      await setTaskStatus({ taskId: subId, status: next })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally { setBusy(false) }
  }

  async function add() {
    if (!name.trim()) return
    setBusy(true); setErr(null)
    try {
      await addSubtask({ parentTaskId, name: name.trim(), ownerId: ownerIdForNewSubtask })
      setName(''); setAdding(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Add failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="border border-outline-variant rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_120px_120px] gap-3 px-4 py-3 bg-surface-container-low font-label-caps text-body-muted">
        <div>Subtasks ({subtasks.length})</div>
        <div>Assignee</div>
        <div>Status</div>
      </div>
      {subtasks.map(s => (
        <div key={s.id} className="grid grid-cols-[1fr_120px_120px] gap-3 px-4 py-3 border-t border-outline-variant items-center font-body-sm text-on-surface-variant">
          <label className="flex items-center gap-3 font-medium">
            <input
              type="checkbox"
              checked={s.status === 'complete'}
              onChange={() => toggle(s.id, s.status)}
              disabled={busy}
              className="w-4 h-4"
            />
            <Link href={`/tasks/${s.id}`} className="hover:underline">{s.name}</Link>
          </label>
          <div>
            <Avatar user={{ id: s.ownerId, name: s.ownerName }} size="sm" />
          </div>
          <div>
            <span className="inline-flex items-center h-6 px-2 rounded-md bg-tertiary-fixed text-tertiary text-[11px] font-semibold">
              {STATUS_SHORT[s.status]}
            </span>
          </div>
        </div>
      ))}
      {canAdd && (
        <div className="px-4 py-3 border-t border-outline-variant">
          {adding ? (
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Subtask name"
                className="flex-1 border border-outline-variant rounded-lg px-3 py-1.5 font-body-sm"
              />
              <button
                onClick={add}
                disabled={busy || !name.trim()}
                className="px-3 h-8 rounded-lg bg-primary text-on-primary text-body-sm font-semibold disabled:opacity-50"
              >Add</button>
              <button
                onClick={() => { setName(''); setAdding(false) }}
                className="px-3 h-8 rounded-lg border border-outline-variant text-body-sm"
              >Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 text-tertiary font-body-sm font-semibold hover:underline"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add subtask
            </button>
          )}
          {err && <div className="text-error text-body-sm mt-2">{err}</div>}
        </div>
      )}
    </div>
  )
}

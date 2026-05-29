'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TaskWithContext } from '@/db/queries/my-tasks'
import type { User } from '@/db/schema'
import { PriorityPill } from './task-row'
import { formatDue, dueIsCritical } from '@/lib/my-tasks/display'
import { approveTask } from '@/app/actions/tasks'

type SerializableUser = Pick<User, 'id' | 'name' | 'role' | 'team' | 'avatarUrl'>

export function ReviewCard({
  item,
  todayDayOffset,
  currentUserId,
  ownerUser,
  reviewerUser,
}: {
  item: TaskWithContext
  todayDayOffset: number
  currentUserId: string
  ownerUser?: SerializableUser | null
  reviewerUser?: SerializableUser | null
}) {
  const router = useRouter()
  const { task, project, phase } = item
  // Personal tasks should never end up here (pending_review only exists in project context),
  // but guard anyway: link to the task detail page when a project is present, otherwise just
  // navigate within the my-tasks page.
  const taskHref = project
    ? `/tasks/${task.id}`
    : '/my-tasks?tab=pending_review'
  const due = {
    targetEndDate: task.targetEndDate ?? null,
    plannedEndDay: task.plannedEndDay,
    todayDayOffset,
    kickedOffAt: project?.kickedOffAt ?? null,
  }
  const dueLabel = formatDue(due)
  const overdue = dueIsCritical(due)
  const iAmReviewer = task.reviewerId === currentUserId
  const iAmOwner = task.ownerId === currentUserId
  const [approving, setApproving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onApprove(e: React.MouseEvent) {
    e.preventDefault()
    setErr(null)
    setApproving(true)
    try {
      await approveTask({ taskId: task.id })
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setApproving(false)
    }
  }

  return (
    <article className="rounded-xl border border-outline-variant/30 bg-white p-md shadow-sm hover:border-outline-variant/60 hover:shadow-md transition-all">
      <div className="flex flex-wrap items-start gap-md">
        {/* Icon (hidden on narrow screens) */}
        <div className="hidden md:grid place-items-center w-10 h-10 rounded-lg bg-tertiary/10 text-tertiary shrink-0">
          <span className="material-symbols-outlined text-[20px]">description</span>
        </div>

        {/* Name + project — shrinks first, truncates */}
        <div className="flex-1 min-w-[200px] basis-full md:basis-auto">
          <Link
            href={taskHref}
            className="font-bold text-body-md text-on-surface hover:text-primary transition-colors block truncate"
          >
            {task.name}
          </Link>
          <div className="mt-xs flex min-w-0">
            {project && phase ? (
              <span
                className="inline-flex items-center max-w-full h-[22px] px-sm rounded-md bg-surface-container text-[11px] font-semibold text-on-surface-variant min-w-0"
                title={`${project.name} · ${phase.name}`}
              >
                <span className="truncate min-w-0">{project.name}</span>
                <span className="shrink-0 opacity-60 ml-xs">· {phase.name}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-xs h-[22px] px-sm rounded-md bg-tertiary/10 text-tertiary text-[11px] font-bold uppercase tracking-wide">
                <span className="material-symbols-outlined text-[12px]">person</span>
                Personal
              </span>
            )}
          </div>
        </div>

        {/* Person + due group — wraps as a block when there isn't room */}
        <div className="flex flex-wrap items-start gap-md shrink-0">
          <PersonField label="Submitted by" user={ownerUser ?? null} />
          <PersonField label="Reviewer" user={reviewerUser ?? null} placeholder="Unassigned" />

          <div className="min-w-[120px]">
            <div className="text-label-caps font-label-caps text-outline tracking-widest mb-xs">Due</div>
            <div
              className={[
                'flex items-center gap-xs text-body-sm font-semibold whitespace-nowrap',
                overdue ? 'text-error' : 'text-on-surface',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[16px]">event</span>
              {dueLabel}
            </div>
            <div className="mt-xs">
              <PriorityPill priority={task.priority} />
            </div>
          </div>
        </div>

        {/* Actions — reviewer vs owner */}
        <div className="flex flex-col gap-xs w-[160px] shrink-0">
          {iAmReviewer ? (
            <>
              <Link
                href={taskHref}
                className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-sm text-body-sm font-bold text-white shadow-sm shadow-primary/10 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Review
              </Link>
              <Link
                href={taskHref}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-outline-variant/40 bg-white text-body-sm font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
              >
                Request Changes
              </Link>
              <button
                type="button"
                onClick={onApprove}
                disabled={approving}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-secondary/40 bg-white text-body-sm font-semibold text-secondary hover:bg-secondary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approving ? 'Approving…' : 'Approve'}
              </button>
            </>
          ) : iAmOwner ? (
            <>
              <span className="inline-flex h-8 items-center justify-center gap-xs rounded-lg bg-tertiary/10 text-tertiary text-[11px] font-bold uppercase tracking-wide">
                <span className="material-symbols-outlined text-[14px]">hourglass_top</span>
                Awaiting Review
              </span>
              <Link
                href={taskHref}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-outline-variant/40 bg-white text-body-sm font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
              >
                View
              </Link>
            </>
          ) : (
            <Link
              href={taskHref}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-outline-variant/40 bg-white text-body-sm font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
            >
              View
            </Link>
          )}
        </div>

        {/* Chevron */}
        <Link
          href={taskHref}
          className="material-symbols-outlined text-outline hover:text-primary transition-colors self-center shrink-0"
          aria-label="Open task"
        >
          chevron_right
        </Link>
      </div>

      {err && (
        <div className="mt-sm flex items-center gap-xs rounded-lg border border-error/20 bg-error/5 px-sm py-xs text-body-sm text-error">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {err}
        </div>
      )}
    </article>
  )
}

function PersonField({
  label,
  user,
  placeholder,
}: {
  label: string
  user: SerializableUser | null
  placeholder?: string
}) {
  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div className="min-w-0">
      <div className="text-label-caps font-label-caps text-outline tracking-widest mb-xs">{label}</div>
      <div className="flex items-center gap-xs text-body-sm font-semibold text-on-surface">
        {user ? (
          <>
            <span className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-full bg-surface-container-high text-[10px] font-bold text-on-surface-variant shrink-0">
              {initials || '?'}
            </span>
            <span className="truncate">{user.name}</span>
          </>
        ) : (
          <span className="italic text-outline">{placeholder ?? '—'}</span>
        )}
      </div>
    </div>
  )
}

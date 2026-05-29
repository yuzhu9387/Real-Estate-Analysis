import Link from 'next/link'
import type { TaskWithContext } from '@/db/queries/my-tasks'
import type { User } from '@/db/schema'
import {
  deriveDisplayStatus,
  STATUS_PILL,
  PRIORITY_PILL,
  formatDue,
  dueIsCritical,
  type DueInputs,
} from '@/lib/my-tasks/display'

function projectKickedOffAt(item: TaskWithContext): Date | null {
  return item.project?.kickedOffAt ?? null
}

/** Build the union of inputs the new formatDue() consumes. */
function dueInputs(item: TaskWithContext, todayDayOffset: number): DueInputs {
  return {
    targetEndDate: item.task.targetEndDate ?? null,
    plannedEndDay: item.task.plannedEndDay,
    todayDayOffset,
    kickedOffAt: projectKickedOffAt(item),
  }
}

/** Returns null for personal tasks (no project to deep-link into). */
function taskHref(item: TaskWithContext): string | null {
  if (!item.project || !item.phase) return null
  const phaseSlug = item.phase.name.toLowerCase()
  return `/projects/${item.project.id}?tab=${phaseSlug}&task=${item.task.id}`
}

/** Small chip shown in place of ProjectChip when the task isn't attached to a project. */
function PersonalChip() {
  return (
    <span className="inline-flex items-center gap-xs h-[22px] px-sm rounded-md bg-tertiary/10 text-tertiary text-[11px] font-bold uppercase tracking-wide">
      <span className="material-symbols-outlined text-[12px]">person</span>
      Personal
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared bits                                                       */
/* ------------------------------------------------------------------ */

export function StatusPill({
  status,
  isBlocked,
}: {
  status: TaskWithContext['task']['status']
  isBlocked: boolean
}) {
  const ds = deriveDisplayStatus({ status, isBlocked })
  const cfg = STATUS_PILL[ds]
  return (
    <span
      className={`inline-flex items-center h-[24px] px-sm rounded-md border text-[11px] font-bold uppercase tracking-wide ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  )
}

export function PriorityPill({ priority }: { priority: 'high' | 'normal' | 'low' }) {
  const cfg = PRIORITY_PILL[priority]
  return (
    <span
      className={`inline-flex items-center h-[24px] px-sm rounded-md border text-[11px] font-bold uppercase tracking-wide ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  )
}

function MiniAvatar({ user }: { user: { name: string } | undefined | null }) {
  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-full bg-surface-container-high text-[10px] font-bold text-on-surface-variant shrink-0">
      {initials || '?'}
    </span>
  )
}

function ProjectChip({ name, phase }: { name: string; phase: string }) {
  // Allow the project name to truncate while the short phase suffix stays visible.
  // The chip becomes shrink-friendly: callers should give the surrounding container `min-w-0`.
  return (
    <span
      className="inline-flex items-center max-w-full h-[22px] px-sm rounded-md bg-surface-container text-[11px] font-semibold text-on-surface-variant min-w-0"
      title={`${name} · ${phase}`}
    >
      <span className="truncate min-w-0">{name}</span>
      <span className="shrink-0 opacity-60 ml-xs">· {phase}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Variants                                                          */
/* ------------------------------------------------------------------ */

/** Compact list-view card used by the Open tab "All Tasks" list.
 *
 *  Layout choices:
 *    - Flex (not grid) so the name+project block can really shrink with the screen.
 *    - Left block uses `flex-1 min-w-0` so its children (especially the ProjectChip)
 *      participate in flex shrinking and truncate cleanly.
 *    - Right block holds fixed-natural-size cells and wraps below the left block
 *      when there isn't enough horizontal room.
 */
export function OpenTaskCard({
  item,
  todayDayOffset,
  ownerUser,
}: {
  item: TaskWithContext
  todayDayOffset: number
  ownerUser?: User | null
}) {
  const { task, project, phase } = item
  const dueLabel = formatDue(dueInputs(item, todayDayOffset))
  const dueRed = dueIsCritical(dueInputs(item, todayDayOffset))
  const href = taskHref(item)
  const Outer = href ? Link : 'div'
  const outerProps = href ? { href } : {}
  return (
    <Outer
      {...(outerProps as { href: string })}
      className="block rounded-xl border border-outline-variant/30 bg-white px-md py-sm shadow-sm hover:border-outline-variant/60 hover:shadow-md hover:-translate-y-px transition-all"
    >
      <div className="flex flex-wrap items-center gap-md">
        {/* Left: name + project (shrinks first) */}
        <div className="flex-1 min-w-0 basis-full sm:basis-auto">
          <div className="font-bold text-body-sm text-on-surface truncate">{task.name}</div>
          <div className="mt-xs flex min-w-0">
            {project && phase ? <ProjectChip name={project.name} phase={phase.name} /> : <PersonalChip />}
          </div>
        </div>

        {/* Right: pills + owner + due + chevron (wrap as a group below on narrow widths) */}
        <div className="flex items-center gap-md flex-wrap sm:flex-nowrap shrink-0">
          <StatusPill status={task.status} isBlocked={task.isBlocked} />
          <PriorityPill priority={task.priority} />
          <div className="flex items-center gap-xs text-body-sm text-on-surface-variant min-w-0 max-w-[160px]">
            <MiniAvatar user={ownerUser ?? null} />
            <span className="truncate">{ownerUser?.name ?? '—'}</span>
          </div>
          <div
            className={[
              'flex items-center gap-xs text-body-sm font-semibold whitespace-nowrap',
              dueRed ? 'text-error' : 'text-on-surface-variant',
            ].join(' ')}
          >
            <span className="material-symbols-outlined text-[16px]">event</span>
            {dueLabel}
          </div>
          {href && <span className="material-symbols-outlined text-outline">chevron_right</span>}
        </div>
      </div>
    </Outer>
  )
}

/** Hero card used by the Priority Focus strip. Vertical layout, accent stripe based on urgency. */
export function PriorityFocusCard({
  item,
  todayDayOffset,
  ownerUser,
}: {
  item: TaskWithContext
  todayDayOffset: number
  ownerUser?: User | null
}) {
  const { task, project, phase } = item
  const dueLabel = formatDue(dueInputs(item, todayDayOffset))
  const overdue = dueIsCritical(dueInputs(item, todayDayOffset))
  const href = taskHref(item)
  const Outer = href ? Link : 'div'
  const outerProps = href ? { href } : {}
  const stripeColor = overdue || task.isBlocked
    ? 'border-t-error'
    : task.priority === 'high'
    ? 'border-t-error'
    : task.priority === 'low'
    ? 'border-t-secondary'
    : 'border-t-tertiary'

  return (
    <Outer
      {...(outerProps as { href: string })}
      className={[
        'block rounded-xl border border-outline-variant/30 bg-white p-md shadow-sm hover:border-outline-variant/60 hover:shadow-md hover:-translate-y-px transition-all',
        'border-t-4',
        stripeColor,
      ].join(' ')}
    >
      <div className="flex items-center gap-xs flex-wrap">
        <PriorityPill priority={task.priority} />
        <StatusPill status={task.status} isBlocked={task.isBlocked} />
      </div>
      <h3 className="mt-sm font-bold text-body-md text-on-surface leading-snug line-clamp-2">
        {task.name}
      </h3>
      <div className="mt-sm">
        {project && phase ? <ProjectChip name={project.name} phase={phase.name} /> : <PersonalChip />}
      </div>
      <div className="mt-sm flex items-center gap-xs text-body-sm text-on-surface-variant">
        <MiniAvatar user={ownerUser ?? null} />
        <span className="truncate">{ownerUser?.name ?? '—'}</span>
      </div>
      <div
        className={[
          'mt-sm flex items-center gap-xs text-body-sm font-semibold',
          overdue ? 'text-error' : 'text-on-surface-variant',
        ].join(' ')}
      >
        <span className="material-symbols-outlined text-[16px]">event</span>
        {dueLabel}
      </div>
    </Outer>
  )
}

/** Kanban card — compact, vertical, no left chevron. */
export function KanbanCard({
  item,
  todayDayOffset,
  ownerUser,
}: {
  item: TaskWithContext
  todayDayOffset: number
  ownerUser?: User | null
}) {
  const { task, project, phase } = item
  const dueLabel = formatDue(dueInputs(item, todayDayOffset))
  const overdue = dueIsCritical(dueInputs(item, todayDayOffset))
  const href = taskHref(item)
  const Outer = href ? Link : 'div'
  const outerProps = href ? { href } : {}
  return (
    <Outer
      {...(outerProps as { href: string })}
      className="block rounded-xl border border-outline-variant/30 bg-white p-sm shadow-sm hover:border-outline-variant/60 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-xs">
        <div className="font-bold text-body-sm text-on-surface leading-snug">
          {task.name}
        </div>
        {href && <span className="material-symbols-outlined text-outline text-[16px] shrink-0">chevron_right</span>}
      </div>
      <div className="mt-xs flex items-center gap-xs flex-wrap">
        <PriorityPill priority={task.priority} />
      </div>
      <div className="mt-xs">
        {project && phase ? <ProjectChip name={project.name} phase={phase.name} /> : <PersonalChip />}
      </div>
      <div className="mt-xs flex items-center gap-xs text-[12px] text-on-surface-variant">
        <MiniAvatar user={ownerUser ?? null} />
        <span className="truncate">{ownerUser?.name ?? '—'}</span>
      </div>
      <div
        className={[
          'mt-xs flex items-center gap-xs text-[12px] font-semibold',
          overdue ? 'text-error' : 'text-on-surface-variant',
        ].join(' ')}
      >
        <span className="material-symbols-outlined text-[14px]">event</span>
        {dueLabel}
      </div>
    </Outer>
  )
}

/** Completed-row card — used on Completed tab. */
export function CompletedCard({ item }: { item: TaskWithContext }) {
  const { task, project, phase } = item
  const finishedDate = new Date(task.updatedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const isWontDo = task.status === 'wont_do'
  const href = taskHref(item)
  const Outer = href ? Link : 'div'
  const outerProps = href ? { href } : {}
  return (
    <Outer
      {...(outerProps as { href: string })}
      className="block rounded-xl border border-outline-variant/30 bg-white px-md py-sm shadow-sm hover:border-outline-variant/60 hover:shadow-md transition-all"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_140px_180px_180px_20px] gap-md items-center">
        <div className="min-w-0">
          <div className="font-bold text-body-sm text-on-surface line-through opacity-80 truncate">
            {task.name}
          </div>
        </div>
        <span
          className={[
            'inline-flex items-center h-[24px] px-sm rounded-md border text-[11px] font-bold uppercase tracking-wide w-fit',
            isWontDo
              ? 'bg-surface-container text-outline border-outline-variant/40'
              : 'bg-secondary/10 text-secondary border-secondary/20',
          ].join(' ')}
        >
          {isWontDo ? "Won't do" : 'Completed'}
        </span>
        <div className="flex items-center gap-xs text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px]">event_available</span>
          <span className="font-data-display">Finished {finishedDate}</span>
        </div>
        <div className="min-w-0">
          {project && phase ? <ProjectChip name={project.name} phase={phase.name} /> : <PersonalChip />}
        </div>
        {href && <span className="material-symbols-outlined text-outline justify-self-end">chevron_right</span>}
      </div>
    </Outer>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-label-caps font-label-caps text-outline tracking-widest mb-xs">{label}</div>
      <div className="text-body-sm text-on-surface-variant font-semibold">{children}</div>
    </div>
  )
}


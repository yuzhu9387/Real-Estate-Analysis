import type { TaskStatus, TaskPriority } from '@/db/schema'

/**
 * Map a task to the user-facing status pill shown on cards.
 * Blocked is its own pill that supersedes the underlying status (matches the kanban + filter semantics).
 */
export type DisplayStatus =
  | 'not_started'
  | 'in_progress'
  | 'under_review'
  | 'blocked'
  | 'completed'

export function deriveDisplayStatus(input: {
  status: TaskStatus
  isBlocked: boolean
}): DisplayStatus {
  if (input.status === 'complete' || input.status === 'wont_do') return 'completed'
  if (input.isBlocked) return 'blocked'
  if (input.status === 'pending_review' || input.status === 'approved') return 'under_review'
  if (input.status === 'started') return 'in_progress'
  return 'not_started'
}

/**
 * Pill class strings — Tailwind classes only, no inline color so they tree-shake correctly.
 * Each variant pairs a tinted background, a foreground color, and a thin border.
 */
export const STATUS_PILL: Record<DisplayStatus, { label: string; classes: string }> = {
  not_started: {
    label: 'Not Started',
    classes: 'bg-surface-container text-on-surface-variant border-outline-variant/40',
  },
  in_progress: {
    label: 'In Progress',
    classes: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  },
  under_review: {
    label: 'Under Review',
    classes: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  },
  blocked: {
    label: 'Blocked',
    classes: 'bg-error/10 text-error border-error/20',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-secondary/10 text-secondary border-secondary/20',
  },
}

export const PRIORITY_PILL: Record<TaskPriority, { label: string; classes: string }> = {
  high: {
    label: 'High',
    classes: 'bg-error/10 text-error border-error/20',
  },
  normal: {
    label: 'Normal',
    classes: 'bg-surface-container text-on-surface-variant border-outline-variant/40',
  },
  low: {
    label: 'Low',
    classes: 'bg-secondary/10 text-secondary border-secondary/20',
  },
}

/**
 * Sort open tasks for the Priority Focus strip: most urgent first.
 * Order: overdue > due today > due soon (high prio) > rest.
 *
 * Blocked tasks are *intentionally never* eligible for Priority Focus — being blocked means
 * there's nothing the owner can do right now, so surfacing them as "focus" would be misleading.
 * The page filters them out before calling this, but we also clamp here as defense-in-depth.
 */
export function priorityFocusScore(input: {
  status: TaskStatus
  priority: TaskPriority
  isBlocked: boolean
  plannedEndDay: number | null
  isOnCriticalPath: boolean
}, todayDayOffset: number): number {
  if (input.status === 'complete' || input.status === 'wont_do') return -1
  if (input.isBlocked) return -1
  let score = 0
  const due = input.plannedEndDay
  if (due !== null) {
    const diff = due - todayDayOffset
    if (diff < 0) score += 1000 + Math.min(-diff, 100) // most overdue first within bucket
    else if (diff === 0) score += 600
    else if (diff <= 2) score += 400
    else if (diff <= 7) score += 200
  }
  if (input.priority === 'high') score += 150
  if (input.priority === 'low') score -= 80
  if (input.isOnCriticalPath) score += 100
  return score
}

/**
 * Format a task's due-date label.
 *
 * Driven primarily by `targetEndDate` (a calendar date "YYYY-MM-DD"). The countdown is real
 * calendar days from today, so "Due in 5d" actually means 5 days from now.
 *
 * Falls back to the legacy `plannedEndDay` (project-relative day offset) only when the task
 * has no materialized target date — typical for tasks on projects that haven't kicked off yet.
 */
export type DueInputs = {
  targetEndDate: string | null
  // Legacy fallback inputs:
  plannedEndDay: number | null
  todayDayOffset: number
  kickedOffAt: Date | null
}

export function formatDue(inputs: DueInputs, today: Date = new Date()): string {
  if (inputs.targetEndDate) {
    const diff = calendarDaysBetween(inputs.targetEndDate, today)
    if (diff < 0) return `Overdue · ${-diff}d`
    if (diff === 0) return 'Due today'
    if (diff === 1) return 'Due tomorrow'
    if (diff <= 7) return `Due in ${diff}d`
    return `Due ${formatShortDate(inputs.targetEndDate)}`
  }

  // Fallback: legacy project-relative day offset (no calendar date materialized yet).
  if (inputs.plannedEndDay === null) return 'No due date'
  const diff = inputs.plannedEndDay - inputs.todayDayOffset
  if (diff < 0) return `Overdue · ${-diff}d`
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  if (inputs.kickedOffAt) {
    const dueDate = new Date(
      inputs.kickedOffAt.getTime() + (inputs.plannedEndDay - 1) * 24 * 60 * 60 * 1000,
    )
    return `Due ${dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  }
  return `Due in ${diff}d`
}

export function dueIsCritical(inputs: DueInputs, today: Date = new Date()): boolean {
  if (inputs.targetEndDate) {
    return calendarDaysBetween(inputs.targetEndDate, today) <= 0
  }
  if (inputs.plannedEndDay === null) return false
  return inputs.plannedEndDay - inputs.todayDayOffset <= 0
}

/* ------------------------------------------------------------------ */
/*  Calendar-date helpers (kept here to avoid an extra import in the   */
/*  card components).                                                  */
/* ------------------------------------------------------------------ */

function calendarDaysBetween(targetIso: string, today: Date): number {
  const t = parseIsoDate(targetIso)
  const n = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((t.getTime() - n.getTime()) / (24 * 60 * 60 * 1000))
}

function parseIsoDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return new Date(s)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function formatShortDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

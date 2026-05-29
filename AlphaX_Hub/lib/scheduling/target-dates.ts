/**
 * Materialize a workflow-task day-offset into a calendar date relative to project kickoff.
 *
 * Day 1 = the day the project was kicked off.
 * Day 2 = one calendar day after kickoff.
 *
 * Returns an ISO date string ("YYYY-MM-DD") suitable for storing in a Postgres `date` column.
 * Returns null when the inputs are insufficient (no kickoff date, or no day offset).
 */
export function materializeTargetDate(
  kickedOffAt: Date | string | null | undefined,
  dayOffset: number | null | undefined,
): string | null {
  if (!kickedOffAt || dayOffset == null || !Number.isFinite(dayOffset)) return null
  const kickoff = typeof kickedOffAt === 'string' ? new Date(kickedOffAt) : kickedOffAt
  if (!(kickoff instanceof Date) || Number.isNaN(kickoff.getTime())) return null
  // Snap kickoff to its local-date midnight so adding integer days never crosses a TZ boundary.
  const base = new Date(kickoff.getFullYear(), kickoff.getMonth(), kickoff.getDate())
  const target = new Date(base)
  target.setDate(base.getDate() + (dayOffset - 1))
  return formatLocalISODate(target)
}

/** "YYYY-MM-DD" in the local timezone — matches Postgres `date` semantics. */
export function formatLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today as "YYYY-MM-DD" in the local timezone. */
export function todayISODate(now: Date = new Date()): string {
  return formatLocalISODate(now)
}

/**
 * Whole-day diff between two ISO dates. Returns (a - b) in days.
 *   daysBetweenISO("2026-01-10", "2026-01-01") === 9
 *   daysBetweenISO("2026-01-01", "2026-01-10") === -9
 */
export function daysBetweenISO(a: string, b: string): number {
  const da = parseISODate(a)
  const db = parseISODate(b)
  return Math.round((da.getTime() - db.getTime()) / (24 * 60 * 60 * 1000))
}

function parseISODate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return new Date(s)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

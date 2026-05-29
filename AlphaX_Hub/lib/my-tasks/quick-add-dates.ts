/**
 * Convert a calendar date (YYYY-MM-DD) to the project-relative day-offset stored on tasks.
 *
 * Day 1 = first day of the project (the day the project was kicked off).
 * Day N = N-1 days after kickoff. So Day 1 ≡ kickedOffAt, Day 2 ≡ kickedOffAt + 1d, etc.
 *
 * If the project hasn't been kicked off, we throw — the caller surfaces the error.
 */
export function dateToDayOffset(date: string, kickedOffAt: Date): number {
  // Parse YYYY-MM-DD as a local date (avoids TZ surprises around midnight UTC).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) throw new Error(`Invalid date format (expected YYYY-MM-DD): ${date}`)
  const [, y, mo, d] = m
  const target = new Date(Number(y), Number(mo) - 1, Number(d))
  // Snap kickedOffAt to its local-date midnight for a clean day diff.
  const k = new Date(kickedOffAt.getFullYear(), kickedOffAt.getMonth(), kickedOffAt.getDate())
  const diffDays = Math.round((target.getTime() - k.getTime()) / (24 * 60 * 60 * 1000))
  // Day 1 = same day as kickoff.
  return diffDays + 1
}

export function validateQuickAddDates(start: string, end: string, kickedOffAt: Date | null): string | null {
  if (!kickedOffAt) {
    return 'Project is not kicked off yet — set the kickoff date on the project before adding tasks here.'
  }
  let startDay: number
  let endDay: number
  try {
    startDay = dateToDayOffset(start, kickedOffAt)
    endDay = dateToDayOffset(end, kickedOffAt)
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid date'
  }
  if (startDay < 1) return 'Target start date is before the project kickoff date.'
  if (endDay < startDay) return 'Target end date must be on or after the target start date.'
  return null
}

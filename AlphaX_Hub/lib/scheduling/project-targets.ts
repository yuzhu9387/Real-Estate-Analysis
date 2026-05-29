/**
 * Project schedule cascade.
 *
 * Section 2 of the project form lets the user supply:
 *   target_start_date
 *   target_permitting_duration_days     (P)
 *   target_construction_duration_days   (C)
 *   target_sales_duration_days          (S)
 *
 * Everything below is derived from those:
 *   target_permit_date          = start + P
 *   target_construction_end_date = permit + C   (i.e. start + P + C)
 *   target_exit_date            = construction_end + S   (i.e. start + P + C + S)
 *   target_project_duration_days = P + C + S
 *
 * The cascade is pure and tolerates nulls — if a duration or the start date is missing, the
 * downstream milestones become null. UI displays null as "—" / hides them.
 */

export type ScheduleInputs = {
  targetStartDate: string | null
  targetPermittingDurationDays: number | null
  targetConstructionDurationDays: number | null
  targetSalesDurationDays: number | null
}

export type ScheduleCascade = {
  targetStartDate: string | null
  targetPermittingDurationDays: number | null
  targetConstructionDurationDays: number | null
  targetSalesDurationDays: number | null
  targetPermitDate: string | null
  targetConstructionEndDate: string | null
  targetExitDate: string | null
  /** Sum of the three phase durations (null if any are missing). */
  targetProjectDurationDays: number | null
}

export function cascadeProjectSchedule(input: ScheduleInputs): ScheduleCascade {
  const start = parseIsoDate(input.targetStartDate)
  const p = nonNegInt(input.targetPermittingDurationDays)
  const c = nonNegInt(input.targetConstructionDurationDays)
  const s = nonNegInt(input.targetSalesDurationDays)

  const targetPermitDate = start && p !== null ? formatIso(addDays(start, p)) : null
  const targetConstructionEndDate =
    start && p !== null && c !== null ? formatIso(addDays(start, p + c)) : null
  const targetExitDate =
    start && p !== null && c !== null && s !== null
      ? formatIso(addDays(start, p + c + s))
      : null
  const targetProjectDurationDays =
    p !== null && c !== null && s !== null ? p + c + s : null

  return {
    targetStartDate: input.targetStartDate,
    targetPermittingDurationDays: p,
    targetConstructionDurationDays: c,
    targetSalesDurationDays: s,
    targetPermitDate,
    targetConstructionEndDate,
    targetExitDate,
    targetProjectDurationDays,
  }
}

/* -------------------------------------------------------------------- */

function parseIsoDate(s: string | null): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function formatIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() + days)
  return r
}

function nonNegInt(v: number | null): number | null {
  if (v === null || v === undefined) return null
  if (!Number.isFinite(v)) return null
  if (!Number.isInteger(v)) return null
  if (v < 0) return null
  return v
}

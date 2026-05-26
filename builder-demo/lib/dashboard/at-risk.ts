export type AtRiskInput = {
  targetPermitDate?: string | null
  actualPermitDate?: string | null
  targetConstructionEndDate?: string | null
  actualConstructionEndDate?: string | null
  targetExitQuarter?: string | null
  sold?: boolean
}

export type AtRiskSeverity = 'permit_overdue' | 'construction_overdue' | 'exit_overdue'

export type AtRiskResult = {
  atRisk: boolean
  severity: AtRiskSeverity | null
  daysBehind: number
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function endOfQuarter(quarterLabel: string | null | undefined): Date | null {
  if (!quarterLabel) return null
  const m = quarterLabel.match(/^(\d{4})-Q([1-4])$/)
  if (!m) return null
  const year = Number(m[1])
  const q = Number(m[2])
  const endMonth = q * 3
  return new Date(year, endMonth, 0)
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000))
}

const SEVERITY_RANK: Record<AtRiskSeverity, number> = {
  permit_overdue: 1,
  construction_overdue: 2,
  exit_overdue: 3,
}

export function evaluateAtRisk(input: AtRiskInput, today: Date): AtRiskResult {
  const triggers: Array<{ severity: AtRiskSeverity; daysBehind: number }> = []

  const tpd = parseDate(input.targetPermitDate)
  if (tpd && tpd < today && !input.actualPermitDate) {
    triggers.push({ severity: 'permit_overdue', daysBehind: daysBetween(today, tpd) })
  }
  const tced = parseDate(input.targetConstructionEndDate)
  if (tced && tced < today && !input.actualConstructionEndDate) {
    triggers.push({ severity: 'construction_overdue', daysBehind: daysBetween(today, tced) })
  }
  const tqe = endOfQuarter(input.targetExitQuarter ?? null)
  if (tqe && tqe < today && !input.sold) {
    triggers.push({ severity: 'exit_overdue', daysBehind: daysBetween(today, tqe) })
  }
  if (triggers.length === 0) return { atRisk: false, severity: null, daysBehind: 0 }

  const worst = triggers.reduce((a, b) => SEVERITY_RANK[a.severity] >= SEVERITY_RANK[b.severity] ? a : b)
  return { atRisk: true, severity: worst.severity, daysBehind: worst.daysBehind }
}

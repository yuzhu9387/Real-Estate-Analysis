export function parseQuarter(s: string | null | undefined): { year: number; q: number } | null {
  if (!s) return null
  const m = s.match(/^(\d{4})-Q([1-4])$/)
  if (!m) return null
  return { year: Number(m[1]), q: Number(m[2]) }
}

export function compareQuarters(a: string | null | undefined, b: string | null | undefined): number {
  const pa = parseQuarter(a)
  const pb = parseQuarter(b)
  if (!pa && !pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  if (pa.year !== pb.year) return pa.year - pb.year
  return pa.q - pb.q
}

export function formatQuarterLabel(s: string | null | undefined): string {
  const p = parseQuarter(s)
  return p ? `${p.year} Q${p.q}` : 'Unscheduled'
}

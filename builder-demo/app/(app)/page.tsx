import { db } from '@/db/client'
import {
  listProjectsForDashboard,
  computeDashboardCounters,
  searchProjects,
} from '@/db/queries/dashboard'
import { evaluateAtRisk } from '@/lib/dashboard/at-risk'
import { deriveCurrentState } from '@/lib/dashboard/current-state'
import { compareQuarters, formatQuarterLabel } from '@/lib/dashboard/quarter'
import { BrandSwitcher } from '@/components/dashboard/brand-switcher'
import { CounterChip } from '@/components/dashboard/counter-chip'
import { SearchBox } from '@/components/dashboard/search-box'
import Link from 'next/link'

type SearchParams = { brand?: 'al_homes'|'alera'|'apex'; filter?: 'active'|'at_risk'|'under_permitting'|'under_construction'; q?: string }

const SEVERITY_RANK = { exit_overdue: 3, construction_overdue: 2, permit_overdue: 1, none: 0 } as const

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const today = new Date()
  const brand = searchParams.brand
  const filter = searchParams.filter
  const q = searchParams.q?.trim() ?? ''

  if (q) {
    const matches = await searchProjects(db, q)
    return (
      <div className="space-y-4">
        <Header brand={brand} />
        <p className="text-sm text-slate-600">Search results for "{q}" — {matches.length} found</p>
        <ul className="space-y-2">
          {matches.map(p => (
            <li key={p.id} className="rounded border bg-white p-3">
              <Link href={`/projects/${p.id}`}>{p.name}</Link>
              <span className="ml-2 text-xs text-slate-500">{p.brand} · {p.status}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const all = await listProjectsForDashboard(db, brand ? { brand } : {})
  const counts = await computeDashboardCounters(db, brand ? { brand } : {}, today)

  const decorated = all.map(p => {
    const risk = evaluateAtRisk({
      targetPermitDate: p.targetPermitDate,
      actualPermitDate: p.actualPermitDate,
      targetConstructionEndDate: p.targetConstructionEndDate,
      actualConstructionEndDate: p.actualConstructionEndDate,
      targetExitQuarter: p.targetExitQuarter,
      sold: p.sold,
    }, today)
    const currentState = deriveCurrentState({
      status: p.status,
      sold: p.sold,
      listingDate: p.listingDate,
      presalePhase1Date: p.presalePhase1Date,
      presalePhase2Date: p.presalePhase2Date,
      presalePhase3Date: p.presalePhase3Date,
      phases: p.phases.map(ph => ({ name: ph.name, status: ph.status, sortOrder: ph.sortOrder })),
    })
    return { ...p, risk, currentState }
  })

  const filtered = decorated.filter(p => {
    if (filter === 'active') return p.status === 'in_progress'
    if (filter === 'at_risk') return p.risk.atRisk
    if (filter === 'under_permitting') return p.phases.find(ph => ph.name === 'Permitting')?.status === 'in_progress'
    if (filter === 'under_construction') return p.phases.find(ph => ph.name === 'Construction')?.status === 'in_progress'
    return true
  })

  const groups = new Map<string, typeof filtered>()
  for (const p of filtered) {
    const key = p.targetExitQuarter ?? '__none'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  const orderedKeys = Array.from(groups.keys()).sort((a, b) =>
    compareQuarters(a === '__none' ? null : a, b === '__none' ? null : b),
  )
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const sa = a.risk.atRisk ? SEVERITY_RANK[a.risk.severity!] : 0
      const sb = b.risk.atRisk ? SEVERITY_RANK[b.risk.severity!] : 0
      if (sa !== sb) return sb - sa
      const da = a.targetPermitDate ?? '9999-12-31'
      const dbb = b.targetPermitDate ?? '9999-12-31'
      return da.localeCompare(dbb)
    })
  }

  return (
    <div className="space-y-6">
      <Header brand={brand} />
      <div className="grid grid-cols-4 gap-3">
        <CounterChip filter="active" label="Active" count={counts.active} />
        <CounterChip filter="at_risk" label="At Risk" count={counts.atRisk} accent="red" />
        <CounterChip filter="under_permitting" label="Under Permitting" count={counts.underPermitting} />
        <CounterChip filter="under_construction" label="Under Construction" count={counts.underConstruction} />
      </div>

      {orderedKeys.map(key => {
        const list = groups.get(key)!
        const atRiskInGroup = list.filter(p => p.risk.atRisk).length
        return (
          <section key={key}>
            <h2 className="mb-2 text-lg font-medium">
              {formatQuarterLabel(key === '__none' ? null : key)} — Target Exit
              <span className="ml-2 text-sm text-slate-500">
                ({list.length} project{list.length === 1 ? '' : 's'}{atRiskInGroup > 0 ? `, ${atRiskInGroup} at risk` : ''})
              </span>
            </h2>
            <ul className="space-y-2">
              {list.map(p => (
                <li key={p.id} className="rounded border bg-white p-3">
                  <Link href={`/projects/${p.id}`} className="flex items-center gap-3">
                    <span>{p.risk.atRisk ? '🔴' : '⚪'}</span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-slate-500">{p.city ?? '—'}{p.state ? `, ${p.state}` : ''}</span>
                    <span className="text-xs text-slate-600">{p.currentState}</span>
                    {p.risk.atRisk && (
                      <span className="ml-auto text-xs text-red-600">{p.risk.daysBehind}d behind</span>
                    )}
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{p.brand}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function Header({ brand }: { brand?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <BrandSwitcher />
      </div>
      <SearchBox />
    </div>
  )
}

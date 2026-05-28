import Link from 'next/link'
import { inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  listProjectsForDashboard,
  computeDashboardCounters,
  searchProjects,
} from '@/db/queries/dashboard'
import { users } from '@/db/schema'
import { evaluateAtRisk } from '@/lib/dashboard/at-risk'
import { deriveCurrentState } from '@/lib/dashboard/current-state'
import { compareQuarters, formatQuarterLabel } from '@/lib/dashboard/quarter'
import { BrandSwitcher } from '@/components/dashboard/brand-switcher'
import { CounterChip } from '@/components/dashboard/counter-chip'

type Filter = 'active' | 'at_risk' | 'under_permitting' | 'under_construction' | 'on_sale'
type SearchParams = {
  brand?: 'al_homes' | 'alera' | 'apex'
  filter?: Filter
  q?: string
}

const SEVERITY_RANK = { exit_overdue: 3, construction_overdue: 2, permit_overdue: 1 } as const

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const today = new Date()
  const brand = searchParams.brand
  const filter = searchParams.filter
  const q = searchParams.q?.trim() ?? ''

  if (q) {
    const matches = await searchProjects(db, q)
    return (
      <div className="space-y-lg">
        <DashboardHeader />
        <section className="glacier-panel rounded-xl p-lg">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-md">
            Search results for &ldquo;{q}&rdquo; — {matches.length} found
          </h2>
          <ul className="divide-y divide-outline-variant/10">
            {matches.map((p) => (
              <li key={p.id} className="py-sm">
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between hover:text-primary transition-colors"
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-body-sm text-on-surface-variant">
                    {p.brand} · {p.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  const all = await listProjectsForDashboard(db, brand ? { brand } : {})
  const counts = await computeDashboardCounters(db, brand ? { brand } : {}, today)

  const pmIds = Array.from(new Set(all.map((p) => p.pmId)))
  const pmRows = pmIds.length
    ? await db.select().from(users).where(inArray(users.id, pmIds))
    : []
  const pmById = new Map(pmRows.map((u) => [u.id, u]))

  const decorated = all.map((p) => {
    const risk = evaluateAtRisk(
      {
        targetPermitDate: p.targetPermitDate,
        actualPermitDate: p.actualPermitDate,
        targetConstructionEndDate: p.targetConstructionEndDate,
        actualConstructionEndDate: p.actualConstructionEndDate,
        targetExitQuarter: p.targetExitQuarter,
        sold: p.sold,
      },
      today,
    )
    const currentState = deriveCurrentState({
      status: p.status,
      sold: p.sold,
      listingDate: p.listingDate,
      presalePhase1Date: p.presalePhase1Date,
      presalePhase2Date: p.presalePhase2Date,
      presalePhase3Date: p.presalePhase3Date,
      phases: p.phases.map((ph) => ({
        name: ph.name,
        status: ph.status,
        sortOrder: ph.sortOrder,
      })),
    })
    const pm = pmById.get(p.pmId)
    return { ...p, risk, currentState, pm }
  })

  const filtered = decorated.filter((p) => {
    if (filter === 'active') return p.status === 'in_progress'
    if (filter === 'at_risk') return p.risk.atRisk
    if (filter === 'under_permitting')
      return p.phases.find((ph) => ph.name === 'Permitting')?.status === 'in_progress'
    if (filter === 'under_construction')
      return p.phases.find((ph) => ph.name === 'Construction')?.status === 'in_progress'
    if (filter === 'on_sale') return !!p.listingDate && !p.sold && p.status === 'in_progress'
    return true
  })

  filtered.sort((a, b) => {
    const qCmp = compareQuarters(a.targetExitQuarter, b.targetExitQuarter)
    if (qCmp !== 0) return qCmp
    const sa = a.risk.atRisk ? SEVERITY_RANK[a.risk.severity!] : 0
    const sb = b.risk.atRisk ? SEVERITY_RANK[b.risk.severity!] : 0
    if (sa !== sb) return sb - sa
    return (a.targetPermitDate ?? '9999-12-31').localeCompare(b.targetPermitDate ?? '9999-12-31')
  })

  return (
    <div className="space-y-lg">
      <DashboardHeader />

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-lg">
        <CounterChip
          filter="active"
          label="ACTIVE PROJECTS"
          count={counts.active}
          icon="trending_up"
          caption="Current live ops"
          accent="primary"
        />
        <CounterChip
          filter="at_risk"
          label="AT RISK"
          count={counts.atRisk}
          icon="report_problem"
          caption="Needs attention"
          accent="error"
        />
        <CounterChip
          filter="under_permitting"
          label="UNDER PERMITTING"
          count={counts.underPermitting}
          icon="assignment_late"
          caption="Awaiting approval"
          accent="neutral"
        />
        <CounterChip
          filter="under_construction"
          label="UNDER CONSTRUCTION"
          count={counts.underConstruction}
          icon="construction"
          caption="In progress"
          accent="secondary"
        />
        <CounterChip
          filter="on_sale"
          label="ON SALE"
          count={counts.onSale}
          icon="sell"
          caption="Market active"
          accent="sale"
        />
      </div>

      <section className="glacier-panel rounded-xl overflow-hidden">
        <div className="px-lg py-md border-b border-outline-variant/30 flex justify-between items-center bg-white/30">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">rocket_launch</span>
            <h3 className="font-headline-md text-headline-md text-on-surface">Projects</h3>
            <span className="text-body-sm text-on-surface-variant">
              ({filtered.length}
              {filtered.filter((p) => p.risk.atRisk).length > 0
                ? `, ${filtered.filter((p) => p.risk.atRisk).length} at risk`
                : ''}
              )
            </span>
          </div>
          <Link
            href="/projects"
            className="text-body-sm text-primary font-semibold hover:underline transition-all"
          >
            View All Activity
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-lg py-md text-label-caps font-label-caps text-outline uppercase tracking-widest">
                  Project Name
                </th>
                <th className="px-lg py-md text-label-caps font-label-caps text-outline uppercase tracking-widest">
                  Status
                </th>
                <th className="px-lg py-md text-label-caps font-label-caps text-outline uppercase tracking-widest">
                  Progress
                </th>
                <th className="px-lg py-md text-label-caps font-label-caps text-outline uppercase tracking-widest">
                  Owner
                </th>
                <th className="px-lg py-md text-label-caps font-label-caps text-outline uppercase tracking-widest">
                  Target Exit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filtered.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-lg py-xl text-center text-body-sm text-on-surface-variant"
                  >
                    No projects match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function DashboardHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between mb-md gap-md">
      <BrandSwitcher />
    </div>
  )
}

type DecoratedProject = Awaited<
  ReturnType<typeof listProjectsForDashboard>
>[number] & {
  risk: ReturnType<typeof evaluateAtRisk>
  currentState: ReturnType<typeof deriveCurrentState>
  pm: { name: string } | undefined
}

function ProjectRow({ project: p }: { project: DecoratedProject }) {
  const badge = statusBadge(p)
  const progress = computeProgress(p)
  const initials = (p.pm?.name ?? '—')
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <tr className="hover:bg-primary/5 transition-colors group">
      <td className="px-lg py-md">
        <Link href={`/projects/${p.id}`} className="flex flex-col">
          <span className="font-semibold text-on-surface group-hover:text-primary transition-colors">
            {p.name}
          </span>
          <span className="text-[11px] text-outline font-data-display">
            #AX-{p.id.slice(0, 6).toUpperCase()}
          </span>
        </Link>
      </td>
      <td className="px-lg py-md">
        <span
          className={[
            'px-sm py-xs text-[10px] font-bold rounded uppercase border',
            badge.classes,
          ].join(' ')}
        >
          {badge.label}
        </span>
      </td>
      <td className="px-lg py-md w-64">
        <div className="flex flex-col gap-xs">
          <div className="flex justify-between text-[10px] font-data-display">
            <span className={progress.pctClass}>{progress.pct}%</span>
            <span className="text-outline">{progress.eta}</span>
          </div>
          <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className={`h-full ${progress.barClass}`}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-lg py-md">
        <div className="flex items-center gap-sm">
          <div className="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-outline border border-outline-variant/30">
            {initials || '—'}
          </div>
          <span className="text-body-sm text-on-surface-variant">{p.pm?.name ?? 'Unassigned'}</span>
        </div>
      </td>
      <td className="px-lg py-md">
        <span className="text-body-sm text-on-surface-variant font-data-display">
          {formatQuarterLabel(p.targetExitQuarter)}
        </span>
      </td>
    </tr>
  )
}

function statusBadge(p: DecoratedProject): { label: string; classes: string } {
  if (p.risk.atRisk) {
    return { label: 'At Risk', classes: 'bg-error/10 text-error border-error/20' }
  }
  if (p.status === 'archived') {
    return {
      label: 'Archived',
      classes: 'bg-surface-container text-outline border-outline-variant/30',
    }
  }
  if (p.status === 'complete') {
    return { label: 'Complete', classes: 'bg-secondary/10 text-secondary border-secondary/20' }
  }
  if (p.status === 'draft') {
    return {
      label: 'Draft',
      classes: 'bg-surface-container text-outline border-outline-variant/30',
    }
  }
  const constructionInProgress =
    p.phases.find((ph) => ph.name === 'Construction')?.status === 'in_progress'
  if (constructionInProgress) {
    return {
      label: 'Construction',
      classes: 'bg-secondary/10 text-secondary border-secondary/20',
    }
  }
  const permitInProgress =
    p.phases.find((ph) => ph.name === 'Permitting')?.status === 'in_progress'
  if (permitInProgress) {
    return {
      label: 'Permitting',
      classes: 'bg-surface-container text-outline border-outline-variant/30',
    }
  }
  return { label: 'Active', classes: 'bg-primary/10 text-primary border-primary/20' }
}

function computeProgress(p: DecoratedProject): {
  pct: number
  eta: string
  pctClass: string
  barClass: string
} {
  const total = p.phases.length || 1
  const completed = p.phases.filter((ph) => ph.status === 'complete').length
  const inProgress = p.phases.filter((ph) => ph.status === 'in_progress').length
  const pct = Math.round(((completed + inProgress * 0.5) / total) * 100)

  let eta = '—'
  if (p.status === 'complete') eta = 'DONE'
  else if (p.status === 'draft') eta = 'PENDING'
  else if (p.risk.atRisk) eta = p.risk.daysBehind ? `${p.risk.daysBehind}D BEHIND` : 'STALLED'
  else {
    const target = p.targetConstructionEndDate ?? p.targetPermitDate
    if (target) {
      const t = new Date(target)
      const diff = Math.ceil((t.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      if (diff > 0) eta = `ETA: ${diff}D`
      else if (diff === 0) eta = 'DUE TODAY'
      else eta = `${Math.abs(diff)}D LATE`
    }
  }

  const pctClass = p.risk.atRisk
    ? 'text-error'
    : pct >= 75
    ? 'text-secondary'
    : pct === 0
    ? 'text-outline'
    : 'text-on-surface'
  const barClass = p.risk.atRisk
    ? 'bg-error'
    : pct === 0
    ? 'bg-outline-variant'
    : 'bg-gradient-to-r from-primary to-secondary'

  return { pct, eta, pctClass, barClass }
}

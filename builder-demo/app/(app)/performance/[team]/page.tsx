import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db/client'
import { computeTeamPerformance } from '@/db/queries/performance'

const TEAMS = ['design', 'construction', 'sales'] as const
type Team = typeof TEAMS[number]
const LABELS: Record<Team, string> = { design: 'Design', construction: 'Construction', sales: 'Sales' }

const RANGES: Record<string, number> = {
  '30':  30 * 24 * 60 * 60 * 1000,
  '90':  90 * 24 * 60 * 60 * 1000,
  '365': 365 * 24 * 60 * 60 * 1000,
}

export default async function PerformancePage({
  params, searchParams,
}: { params: { team: string }; searchParams: { range?: string } }) {
  if (!(TEAMS as readonly string[]).includes(params.team)) notFound()
  const team = params.team as Team
  const rangeKey = searchParams.range && RANGES[searchParams.range] ? searchParams.range : '90'
  const until = new Date()
  const since = new Date(until.getTime() - RANGES[rangeKey])

  const metrics = await computeTeamPerformance(db, { team, since, until })
  const pct = (x: number) => `${Math.round(x * 100)}%`

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Performance Review</h1>
      <Tabs current={team} />
      <RangePicker current={rangeKey} team={team} />

      <h2 className="text-lg font-medium">{LABELS[team]} team — last {rangeKey} days</h2>

      <div className="grid grid-cols-3 gap-3">
        <Card title="Tasks completed" value={String(metrics.tasksCompleted)} />
        <Card title="First-pass approval" value={pct(metrics.firstPassApprovalRate)} />
        <Card title="Revision rate" value={pct(metrics.revisionRate)} />
      </div>

      <p className="text-sm text-slate-600">Won't-do count: {metrics.wontDoCount}</p>

      <h3 className="text-md font-medium pt-4">Per-person breakdown</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1">Name</th>
            <th className="text-left py-1">Tasks completed</th>
            <th className="text-left py-1">First-pass approval</th>
          </tr>
        </thead>
        <tbody>
          {metrics.perPerson.map(p => (
            <tr key={p.userId} className="border-b">
              <td className="py-1">{p.name}</td>
              <td className="py-1">{p.tasksCompleted}</td>
              <td className="py-1">{pct(p.firstPassApprovalRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Tabs({ current }: { current: Team }) {
  return (
    <div className="flex gap-2 border-b border-slate-200">
      {TEAMS.map(t => (
        <Link key={t} href={`/performance/${t}`}
          className={[
            'px-3 py-2 text-sm',
            t === current ? 'border-b-2 border-blue-500 font-medium' : 'text-slate-600',
          ].join(' ')}>
          {LABELS[t]}
        </Link>
      ))}
    </div>
  )
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded border bg-white p-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-slate-600">{title}</div>
    </div>
  )
}

function RangePicker({ current, team }: { current: string; team: Team }) {
  return (
    <div className="flex gap-2 text-sm">
      {Object.keys(RANGES).map(k => (
        <Link key={k} href={`/performance/${team}?range=${k}`}
          className={[
            'rounded px-2 py-1',
            k === current ? 'bg-slate-200' : 'text-slate-600 hover:bg-slate-100',
          ].join(' ')}>
          Last {k} days
        </Link>
      ))}
    </div>
  )
}

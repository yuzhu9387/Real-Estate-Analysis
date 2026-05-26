import Link from 'next/link'
import { inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db/client'
import { tasks } from '@/db/schema'
import { listActiveProjectsForTeam } from '@/db/queries/dashboard'
import { deriveCurrentState } from '@/lib/dashboard/current-state'

const TEAMS = ['design', 'construction', 'sales'] as const
type Team = typeof TEAMS[number]
const LABELS: Record<Team, string> = { design: 'Design', construction: 'Construction', sales: 'Sales' }

export default async function TeamPage({ params }: { params: { team: string } }) {
  if (!(TEAMS as readonly string[]).includes(params.team)) notFound()
  const team = params.team as Team

  const projectsForTeam = await listActiveProjectsForTeam(db, { team })
  const projectIds = projectsForTeam.map(p => p.id)
  const allTeamTasks = projectIds.length === 0 ? [] : await db.select().from(tasks)
    .where(inArray(tasks.projectId, projectIds))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Team</h1>
      <Tabs current={team} />
      <h2 className="text-lg font-medium">{LABELS[team]} team — active projects</h2>
      <ul className="space-y-2">
        {projectsForTeam.map(p => {
          const teamTasks = allTeamTasks.filter(t => t.projectId === p.id)
          const activeCount = teamTasks.filter(t => t.status !== 'complete' && t.status !== 'wont_do').length
          const blockedCount = teamTasks.filter(t => t.isBlocked).length
          const state = deriveCurrentState({
            status: p.status, sold: p.sold,
            listingDate: p.listingDate,
            presalePhase1Date: p.presalePhase1Date,
            presalePhase2Date: p.presalePhase2Date,
            presalePhase3Date: p.presalePhase3Date,
            phases: p.phases.map(ph => ({ name: ph.name, status: ph.status, sortOrder: ph.sortOrder })),
          })
          return (
            <li key={p.id} className="rounded border bg-white p-3">
              <Link href={`/projects/${p.id}`} className="flex items-center gap-3">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-zinc-500">{p.city ?? '—'}</span>
                <span className="text-xs text-zinc-600">{state}</span>
                <span className="ml-auto text-xs">{activeCount} active task{activeCount === 1 ? '' : 's'}{blockedCount > 0 ? `, ${blockedCount} blocked` : ''}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Tabs({ current }: { current: Team }) {
  return (
    <div className="flex gap-2 border-b border-zinc-200">
      {TEAMS.map(t => (
        <Link key={t} href={`/team/${t}`}
          className={[
            'px-3 py-2 text-sm',
            t === current ? 'border-b-2 border-blue-500 font-medium' : 'text-zinc-600',
          ].join(' ')}>
          {LABELS[t]}
        </Link>
      ))}
    </div>
  )
}

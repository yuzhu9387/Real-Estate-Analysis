import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { projects, projectPhases, projectWorkflows, tasks } from '@/db/schema'
import { notFound } from 'next/navigation'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const projRows = await db.select().from(projects).where(eq(projects.id, params.id))
  if (projRows.length === 0) notFound()
  const project = projRows[0]
  const phases = await db.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
  const flows  = await db.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, project.id))
  const taskList = await db.select().from(tasks).where(eq(tasks.projectId, project.id))
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{project.name}</h1>
      <section>
        <h2 className="text-lg font-medium">Phases</h2>
        <ul>{phases.map(p => <li key={p.id}>{p.name} — {p.status}</li>)}</ul>
      </section>
      <section>
        <h2 className="text-lg font-medium">Workflows</h2>
        <ul>{flows.map(f => <li key={f.id}>{f.name} — {f.status}</li>)}</ul>
      </section>
      <section>
        <h2 className="text-lg font-medium">Tasks</h2>
        <ul>{taskList.map(t => (
          <li key={t.id}>
            {t.name} — {t.status}
            {t.isBlocked ? ' (blocked)' : ''}{t.isUnplanned ? ' (unplanned)' : ''}{t.isOnCriticalPath ? ' (critical)' : ''}
          </li>
        ))}</ul>
      </section>
    </div>
  )
}

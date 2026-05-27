import Link from 'next/link'
import { sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks } from '@/db/schema'

export default async function WorkflowsPage({
  searchParams,
}: { searchParams: { archived?: string } }) {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  const showArchived = searchParams.archived === '1'

  const tplRows = await db.select().from(workflowTemplates).orderBy(workflowTemplates.name)
  const counts = await db.select({
    workflowTemplateId: workflowTemplateTasks.workflowTemplateId,
    c: sql<number>`count(*)::int`,
  }).from(workflowTemplateTasks).groupBy(workflowTemplateTasks.workflowTemplateId)
  const countById = new Map(counts.map(r => [r.workflowTemplateId, r.c]))

  const list = showArchived ? tplRows : tplRows.filter(t => !t.isArchived)

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="text-2xl font-semibold">Workflow Templates</h1>
        <Link href="/workflows/new"
          className="ml-auto px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90">
          + New template
        </Link>
      </div>

      <div className="text-xs">
        <Link href={showArchived ? '/workflows' : '/workflows?archived=1'}
          className="text-blue-600 hover:underline">
          {showArchived ? 'Hide archived' : 'Show archived'}
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500 text-sm">
          No templates yet. Click &quot;+ New template&quot; to start.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map(w => (
            <li key={w.id} className="rounded border border-zinc-200 bg-white px-3 py-2 hover:bg-zinc-50">
              <Link href={`/workflows/${w.id}`} className="flex items-center gap-3">
                <span className={`font-medium ${w.isArchived ? 'text-zinc-400' : ''}`}>{w.name}</span>
                {w.isArchived && <span className="text-xs bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded">archived</span>}
                <span className="ml-auto text-xs text-zinc-500">{countById.get(w.id) ?? 0} tasks</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

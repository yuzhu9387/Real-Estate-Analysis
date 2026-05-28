import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { listWorkflowTemplates } from '@/db/queries/workflow-templates'
import { ListSearch } from '@/components/workflows/list-search'

export default async function WorkflowsPage({
  searchParams,
}: { searchParams: { archived?: string; q?: string } }) {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  const showArchived = searchParams.archived === '1'
  const q = searchParams.q?.trim()

  const list = await listWorkflowTemplates({ q, includeArchived: showArchived }, db)

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="text-2xl font-semibold">Workflow Templates</h1>
        <Link href="/workflows/new"
          className="ml-auto px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90">
          + New template
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <ListSearch />
        <Link href={showArchived
            ? `/workflows${q ? `?q=${encodeURIComponent(q)}` : ''}`
            : `/workflows?archived=1${q ? `&q=${encodeURIComponent(q)}` : ''}`}
          className="text-xs text-blue-600 hover:underline whitespace-nowrap">
          {showArchived ? 'Hide archived' : 'Show archived'}
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500 text-sm">
          {q
            ? <>No templates match &quot;{q}&quot;.</>
            : <>No templates yet. Click &quot;+ New template&quot; to start.</>}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map(w => (
            <li key={w.id} className="rounded border border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50">
              <Link href={`/workflows/${w.id}`} className="block">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${w.isArchived ? 'text-zinc-400' : ''}`}>{w.name}</span>
                  {w.isArchived && (
                    <span className="text-xs bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded">archived</span>
                  )}
                </div>
                {w.description && (
                  <div className="text-sm text-zinc-500 mt-0.5 line-clamp-1">{w.description}</div>
                )}
                <div className="text-xs text-zinc-500 mt-1">
                  {w.taskCount} tasks · {w.totalDurationDays} days
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

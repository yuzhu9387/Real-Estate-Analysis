import { db } from '@/db/client'
import { workflowTemplates } from '@/db/schema'

export default async function WorkflowsPage() {
  const list = await db.select().from(workflowTemplates)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Workflow Templates</h1>
      <ul className="space-y-2">
        {list.map(w => (
          <li key={w.id} className="rounded border bg-white p-3">
            <a href={`/workflows/${w.id}`}>{w.name}</a>
            {w.isArchived && <span className="ml-2 text-xs text-slate-500">archived</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

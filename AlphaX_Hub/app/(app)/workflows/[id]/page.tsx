import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps, users } from '@/db/schema'
import { DuplicatePrompt } from '@/components/workflows/duplicate-prompt'

export default async function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')

  const tpl = (await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, params.id)))[0]
  if (!tpl) notFound()
  const tasks = (await db.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id)))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const deps = await db.select().from(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, tpl.id))
  const creator = (await db.select().from(users).where(eq(users.id, tpl.createdById)))[0]

  const depsByTo = new Map<string, string[]>()
  for (const d of deps) {
    if (!depsByTo.has(d.toTaskId)) depsByTo.set(d.toTaskId, [])
    depsByTo.get(d.toTaskId)!.push(d.fromTaskId)
  }
  const taskNameById = new Map(tasks.map(t => [t.id, t.name]))

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <Link href="/workflows" className="text-blue-600 text-sm hover:underline">← Back to list</Link>
        <div className="ml-auto flex gap-2">
          {!tpl.isArchived && (
            <Link href={`/workflows/${tpl.id}/edit`}
              className="px-3 py-1.5 rounded text-sm border border-zinc-300 hover:bg-zinc-50">
              Edit
            </Link>
          )}
          <DuplicatePrompt sourceId={tpl.id} sourceName={tpl.name} />
        </div>
      </div>
      <h1 className="text-2xl font-semibold flex items-center gap-3">
        {tpl.name}
        {tpl.isArchived && <span className="text-xs bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded">archived</span>}
      </h1>
      {tpl.description && <p className="text-sm text-zinc-600">{tpl.description}</p>}

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Tasks ({tasks.length})</h2>
        {tasks.length === 0 && <div className="text-sm text-zinc-500">No tasks.</div>}
        <ol className="space-y-2">
          {tasks.map((t, i) => {
            const upstreamIds = depsByTo.get(t.id) ?? []
            return (
              <li key={t.id} className="text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 w-6">{i + 1}.</span>
                  <span className="flex-1">{t.name}</span>
                  <span className="text-zinc-500">{t.defaultEndDay - t.defaultStartDay}d</span>
                  {t.defaultOwnerRoleLabel && <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">{t.defaultOwnerRoleLabel}</span>}
                </div>
                {upstreamIds.length > 0 && (
                  <div className="ml-9 text-xs text-zinc-500 mt-0.5">
                    ← depends on: {upstreamIds.map(id => taskNameById.get(id)).filter(Boolean).join(', ')}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <div className="text-xs text-zinc-500">
        Created by {creator?.name ?? 'Unknown'} · {tpl.createdAt.toLocaleDateString()}
      </div>
    </div>
  )
}

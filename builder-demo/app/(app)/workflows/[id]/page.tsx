import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { notFound } from 'next/navigation'

export default async function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const tpl = (await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, params.id)))[0]
  if (!tpl) notFound()
  const tplTasks = await db.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id))
  const tplDeps  = await db.select().from(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, tpl.id))
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{tpl.name}</h1>
      <section>
        <h2 className="text-lg font-medium">Tasks</h2>
        <ul>{tplTasks.map(t => <li key={t.id}>{t.name} — {t.defaultDurationDays}d</li>)}</ul>
      </section>
      <section>
        <h2 className="text-lg font-medium">Dependencies</h2>
        <ul>{tplDeps.map(d => <li key={d.id}>{d.fromTaskId} → {d.toTaskId}</li>)}</ul>
      </section>
    </div>
  )
}
